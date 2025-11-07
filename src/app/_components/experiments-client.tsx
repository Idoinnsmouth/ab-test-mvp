"use client";

import { useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { statusLabels } from "./experiments/constants";
import { ExperimentFormDialog } from "./experiments/experiment-form-dialog";
import { ExperimentsTable } from "./experiments/experiments-table";
import { useExperiments } from "./experiments/use-experiments";
import { type Experiment } from "./experiments/types";

export function ExperimentsClient() {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    experiments,
    isLoading,
    isFetching,
    error,
    deleteExperiment,
    deletePending,
  } = useExperiments();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Experiment | null>(null);

  const handleDelete = (experiment: Experiment) => {
    const shouldDelete = window.confirm(
      `Delete experiment "${experiment.name}"? This action cannot be undone.`,
    );
    if (!shouldDelete) return;

    deleteExperiment(experiment.id);
  };

  return (
    <section className="space-y-6 rounded-xl border border-white/10 bg-white/2 p-6 shadow-[0_20px_120px_rgba(0,0,0,0.65)] backdrop-blur">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Control Center
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Experiments overview
          </h1>
          <p className="text-sm text-zinc-400">
            Create, review, and iterate on your experiments before rolling them
            out to real traffic.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="text-zinc-500 absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name or strategy"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="bg-white/5 pl-9 text-white placeholder:text-zinc-500"
            />
          </div>
          <div className="w-full sm:max-w-xs">
            <label className="sr-only" htmlFor="status-filter">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value === "all"
                    ? "all"
                    : (event.target.value as typeof statusFilter),
                )
              }
              className="border-input bg-white/5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 h-9 w-full rounded-md border px-3"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-white/80">
                <PlusIcon className="size-4" />
                New Experiment
              </Button>
            </DialogTrigger>
            <ExperimentFormDialog
              mode="create"
              open={createOpen}
              onOpenChange={setCreateOpen}
              existingExperimentNames={experiments.map(
                (existing) => existing.name,
              )}
            />
          </Dialog>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load experiments. Please try again.
        </div>
      ) : (
        <ExperimentsTable
          experiments={experiments}
          isFetching={isFetching}
          isLoading={isLoading}
          onEdit={setEditing}
          onDelete={handleDelete}
          disableDelete={deletePending}
        />
      )}

      <Dialog open={!!editing} onOpenChange={(value) => !value && setEditing(null)}>
        <ExperimentFormDialog
          mode="edit"
          experiment={editing ?? undefined}
          open={!!editing}
          onOpenChange={(value) => {
            if (!value) setEditing(null);
          }}
          existingExperimentNames={experiments.map((existing) => existing.name)}
        />
      </Dialog>
    </section>
  );
}
