import { skipToken } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { api } from "~/trpc/react";

import {
  type EditableVariant,
  type Experiment,
  type Variant,
} from "../types";

const TOTAL_WEIGHT = 100;

const clampWeight = (value: number) =>
  Math.max(0, Math.min(TOTAL_WEIGHT, Math.round(value)));

const coerceWeight = (weight: EditableVariant["weight"]) =>
  clampWeight(typeof weight === "number" ? weight : Number(weight) || 0);

const distributeWeights = (
  weights: number[],
  desiredTotal: number,
): number[] => {
  if (weights.length === 0) return [];
  if (desiredTotal <= 0) return new Array<number>(weights.length).fill(0);
  if (weights.length === 1) return [desiredTotal];

  const currentTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (currentTotal === 0) {
    const base = Math.floor(desiredTotal / weights.length);
    let remainder = desiredTotal - base * weights.length;
    return weights.map(() => {
      if (remainder > 0) {
        remainder -= 1;
        return base + 1;
      }
      return base;
    });
  }

  const scaled = weights.map((weight) => (weight / currentTotal) * desiredTotal);
  const floored = scaled.map((value) => Math.floor(value));
  let remainder = desiredTotal - floored.reduce((sum, value) => sum + value, 0);

  const order = scaled
    .map((value, index) => ({ index, fraction: value - floored[index]! }))
    .sort((a, b) => b.fraction - a.fraction);

  let pointer = 0;
  while (remainder > 0 && order.length > 0) {
    const target = order[pointer % order.length]!;
    floored[target.index]! += 1;
    remainder -= 1;
    pointer += 1;
  }

  return floored;
};

const applyWeights = (
  variants: EditableVariant[],
  weights: number[],
): EditableVariant[] =>
  variants.map((variant, index) => ({
    ...variant,
    weight: weights[index] ?? 0,
  }));

const rebalanceAllVariants = (variants: EditableVariant[]): EditableVariant[] => {
  if (variants.length === 0) return variants;
  const parsed = variants.map((variant) => coerceWeight(variant.weight));
  const redistributed = distributeWeights(parsed, TOTAL_WEIGHT);
  return applyWeights(variants, redistributed);
};

const rebalanceWithLock = (
  variants: EditableVariant[],
  lockedIndex: number,
  nextWeight: number,
): EditableVariant[] => {
  if (variants.length === 0) return variants;
  const parsed = variants.map((variant) => coerceWeight(variant.weight));
  const target = clampWeight(nextWeight);
  const remaining = Math.max(0, TOTAL_WEIGHT - target);
  const otherIndices = variants
    .map((_, index) => index)
    .filter((index) => index !== lockedIndex);

  if (otherIndices.length === 0) {
    parsed[lockedIndex] = target;
    return applyWeights(variants, parsed);
  }

  const otherWeights = otherIndices.map((index) => parsed[index]!);
  const redistributed = distributeWeights(otherWeights, remaining);

  parsed[lockedIndex] = target;
  otherIndices.forEach((index, mapIndex) => {
    parsed[index] = redistributed[mapIndex] ?? 0;
  });

  return applyWeights(variants, parsed);
};

const makeEditable = (variant: Variant): EditableVariant => ({
  id: variant.id,
  key: variant.key,
  weight: variant.weight,
});

const sanitizeEditableVariant = (variant: EditableVariant) => ({
  id: variant.id,
  key: variant.key.trim().toUpperCase(),
  weight:
    typeof variant.weight === "number"
      ? variant.weight
      : Number(variant.weight),
});

const normalizeVariants = (variants: Array<Variant | EditableVariant>) =>
  JSON.stringify(
    variants.map((variant) => ({
      id: variant.id ?? null,
      key: variant.key,
      weight:
        typeof variant.weight === "number"
          ? variant.weight
          : Number(variant.weight) || 0,
    })),
  );

const nextVariantKey = (current: EditableVariant[]) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const used = new Set(current.map((variant) => variant.key));
  for (const letter of alphabet) {
    if (!used.has(letter)) return letter;
  }
  return `VAR_${current.length + 1}`;
};

type SanitizedVariant = ReturnType<typeof sanitizeEditableVariant>;
type ValidationResult =
  | { data: SanitizedVariant[] }
  | { error: string };

export function useVariants() {
  const utils = api.useUtils();
  const {
    data: experiments = [],
    isLoading: experimentsLoading,
    isFetching: experimentsFetching,
  } = api.experiments.list.useQuery(undefined, {
    placeholderData: (prev) => prev ?? [],
  });

  const [selectedExperimentId, setSelectedExperimentId] = useState<string>();
  const [variants, setVariants] = useState<EditableVariant[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (experiments.length === 0) {
      setSelectedExperimentId(undefined);
      return;
    }

    const exists = experiments.some(
      (experiment) => experiment.id === selectedExperimentId,
    );

    if (!selectedExperimentId || !exists) {
      setSelectedExperimentId(experiments[0]?.id);
    }
  }, [experiments, selectedExperimentId]);

  const variantsQuery = api.variants.list.useQuery(
    selectedExperimentId ? { experimentId: selectedExperimentId } : skipToken,
    {
      enabled: Boolean(selectedExperimentId),
      placeholderData: (prev) => prev ?? [],
    },
  );

  useEffect(() => {
    if (variantsQuery.data) {
      setVariants(rebalanceAllVariants(variantsQuery.data.map(makeEditable)));
      setLocalError(null);
    } else {
      setVariants([]);
    }
  }, [variantsQuery.data, selectedExperimentId]);

  const upsertMutation = api.variants.upsertMany.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.variants.list.invalidate({
        experimentId: variables.experimentId,
      });
      setLocalError(null);
    },
    onError: (error) => {
      setLocalError(error.message);
    },
  });

  // using useMemo here to avoid re-normlazing a long list (thinking about scale)
  const normalizedServer = useMemo(
    () => normalizeVariants(variantsQuery.data ?? []),
    [variantsQuery.data],
  );

  // using useMemo here to avoid re-normlazing a long list (thinking about scale)
  const normalizedLocal = useMemo(
    () => normalizeVariants(variants),
    [variants],
  );

  const hasChanges = normalizedLocal !== normalizedServer;
  const isBusy =
    variantsQuery.isFetching || upsertMutation.isPending || experimentsFetching;

  const updateVariantField = (
    index: number,
    key: keyof EditableVariant,
    value: string,
  ) => {
    setVariants((prev) => {
      if (key === "weight") {
        const numericValue = clampWeight(Number(value));
        return rebalanceWithLock(prev, index, numericValue);
      }

      return prev.map((variant, variantIndex) => {
        if (variantIndex !== index) return variant;
        return { ...variant, [key]: value.toUpperCase() };
      });
    });
  };

  const addVariant = () => {
    setVariants((prev) =>
      rebalanceAllVariants([
        ...prev,
        { key: nextVariantKey(prev), weight: clampWeight(TOTAL_WEIGHT / (prev.length + 1)) },
      ]),
    );
  };

  const removeVariant = (index: number) => {
    setVariants((prev) =>
      rebalanceAllVariants(prev.filter((_, variantIndex) => variantIndex !== index)),
    );
  };

  const resetVariants = () => {
    if (variantsQuery.data) {
      setVariants(rebalanceAllVariants(variantsQuery.data.map(makeEditable)));
      setLocalError(null);
    }
  };

  const validateVariants = (): ValidationResult => {
    if (!selectedExperimentId) {
      return { error: "Choose an experiment first." };
    }

    if (variants.length < 2) {
      return { error: "Provide at least two variants." };
    }

    const sanitized = variants.map(sanitizeEditableVariant);

    for (const variant of sanitized) {
      if (!variant.key) {
        return { error: "Variant keys cannot be empty." };
      }

      if (
        Number.isNaN(variant.weight) ||
        variant.weight < 0 ||
        variant.weight > 100
      ) {
        return { error: "Weights must be integers between 0 and 100." };
      }

      if (!Number.isInteger(variant.weight)) {
        return { error: "Weights must be whole numbers." };
      }
    }

    const keys = sanitized.map((variant) => variant.key);
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      return { error: "Variant keys must be unique." };
    }

    const totalWeight = sanitized.reduce((sum, variant) => sum + variant.weight, 0);
    if (totalWeight !== TOTAL_WEIGHT) {
      return { error: "Variant weights must add up to 100%." };
    }

    return { data: sanitized };
  };

  const saveVariants = () => {
    const validation = validateVariants();
    if ("error" in validation) {
      setLocalError(validation.error);
      return;
    }

    if (!selectedExperimentId) return;

    setLocalError(null);
    upsertMutation.mutate({
      experimentId: selectedExperimentId,
      variants: validation.data,
    });
  };

  const selectedExperiment: Experiment | undefined = experiments.find(
    (experiment) => experiment.id === selectedExperimentId,
  );

  return {
    experiments,
    experimentsLoading,
    experimentsFetching,
    selectedExperiment,
    selectedExperimentId,
    setSelectedExperimentId,
    variants,
    localError,
    setLocalError,
    hasChanges,
    isBusy,
    isSaving: upsertMutation.isPending,
    addVariant,
    removeVariant,
    resetVariants,
    updateVariantField,
    saveVariants,
    canRemoveVariant: variants.length > 2,
    canReset: hasChanges && variants.length > 0,
    canSave:
      Boolean(selectedExperimentId) &&
      hasChanges &&
      variants.length >= 2 &&
      !isBusy,
    showInitialLoading: experimentsLoading && experiments.length === 0,
    showEmptyState: !experimentsLoading && experiments.length === 0,
  };
}
