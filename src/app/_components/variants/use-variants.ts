import { skipToken } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { api } from "~/trpc/react";
import {
  type EditableVariant,
  type Experiment,
  type Variant,
} from "./types";

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
      setVariants(variantsQuery.data.map(makeEditable));
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

  const normalizedServer = useMemo(
    () => normalizeVariants(variantsQuery.data ?? []),
    [variantsQuery.data],
  );

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
    setVariants((prev) =>
      prev.map((variant, variantIndex) => {
        if (variantIndex !== index) return variant;

        if (key === "weight") {
          const numeric = value === "" ? "" : Number(value);
          return { ...variant, weight: Number.isNaN(numeric) ? "" : numeric };
        }

        return { ...variant, [key]: value.toUpperCase() };
      }),
    );
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { key: nextVariantKey(prev), weight: 50 },
    ]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, variantIndex) => variantIndex !== index));
  };

  const resetVariants = () => {
    if (variantsQuery.data) {
      setVariants(variantsQuery.data.map(makeEditable));
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
