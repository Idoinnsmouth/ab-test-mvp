"use client";

import { Loader2Icon, PlusIcon, SaveIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { VariantsTable } from "./variants/variants-table";
import { useVariants } from "./variants/use-variants";

export function VariantsClient() {
  const {
    experiments,
    experimentsLoading,
    selectedExperiment,
    selectedExperimentId,
    setSelectedExperimentId,
    variants,
    localError,
    addVariant,
    removeVariant,
    resetVariants,
    updateVariantField,
    saveVariants,
    canRemoveVariant,
    canReset,
    canSave,
    showInitialLoading,
    showEmptyState,
    isSaving,
  } = useVariants();

  if (showInitialLoading) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/2 p-6 text-white">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2Icon className="size-4 animate-spin" />
          Loading experiments…
        </div>
      </section>
    );
  }

  if (showEmptyState || experiments.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-white/10 bg-white/2 p-6 text-center text-sm text-zinc-400">
        No experiments yet. Create one first to configure variants.
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-xl border border-white/10 bg-white/2 p-6 text-white shadow-[0_20px_120px_rgba(0,0,0,0.65)] backdrop-blur">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Variant Management
        </p>
        <h2 className="text-2xl font-semibold">Configure variants</h2>
        <p className="text-sm text-zinc-400">
          Add, edit, or remove experiment variants. Ensure at least two variants
          exist per experiment.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200" htmlFor="experiment-select">
            Experiment
          </label>
          <select
            id="experiment-select"
            value={selectedExperimentId ?? ""}
            onChange={(event) => setSelectedExperimentId(event.target.value)}
            className="border-input bg-white/5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 h-10 rounded-md border px-3"
            disabled={experimentsLoading}
          >
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.id}>
                {experiment.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            onClick={addVariant}
            disabled={!selectedExperimentId}
            className="bg-white text-black hover:bg-white/80"
          >
            <PlusIcon className="size-4" />
            Add variant
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetVariants}
            disabled={!canReset}
            className="border-white/30 text-white hover:bg-white/10"
          >
            Reset
          </Button>
        </div>
      </div>

      {selectedExperiment ? (
        <VariantsTable
          variants={variants}
          onChange={updateVariantField}
          onRemove={removeVariant}
          disableRemove={!canRemoveVariant}
        />
      ) : null}

  {localError && (
        <p className="text-sm text-red-400" role="alert">
          {localError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onClick={saveVariants}
          disabled={!canSave}
          className="bg-white text-black hover:bg-white/80 disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <SaveIcon className="mr-2 size-4" />
          )}
          Save variants
        </Button>
      </div>
    </section>
  );
}
