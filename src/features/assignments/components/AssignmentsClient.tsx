"use client";

import { useEffect, useState } from "react";
import { Loader2Icon, RefreshCwIcon, UserIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { useAssignmentsApi } from "../hooks/useAssignments";
import { type AssignmentResult, type Experiment } from "../types";

export function AssignmentsClient() {
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>();
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    experimentsQuery,
    experiments,
    assignmentQuery,
    assignmentsListQuery,
    assignMutation,
    canLookup,
    trimmedUserId,
  } = useAssignmentsApi(selectedExperimentId, userId);

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

  useEffect(() => {
    if (!canLookup) {
      setResult(null);
      return;
    }
    if (assignmentQuery.data) {
      setResult(assignmentQuery.data);
    } else if (!assignmentQuery.isFetching) {
      setResult(null);
    }
  }, [assignmentQuery.data, assignmentQuery.isFetching, canLookup]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedExperimentId) {
      setLocalError("Select an experiment first.");
      return;
    }

    if (trimmedUserId.length < 3) {
      setLocalError("Provide a user ID with at least 3 characters.");
      return;
    }

    setLocalError(null);
    assignMutation.mutate(
      {
        experimentId: selectedExperimentId,
        userId: trimmedUserId,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setLocalError(null);
        },
        onError: (error) => {
          setLocalError(error.message);
        },
      },
    );
  };

  if (experimentsQuery.isLoading && experiments.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/2 p-6 text-white">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2Icon className="size-4 animate-spin" />
          Loading experiments…
        </div>
      </section>
    );
  }

  if (!experimentsQuery.isLoading && experiments.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-white/10 bg-white/2 p-6 text-center text-sm text-zinc-400">
        No experiments yet. Create one first to assign users.
      </section>
    );
  }

  const selectedExperiment: Experiment | undefined = experiments.find(
    (experiment) => experiment.id === selectedExperimentId,
  );

  return (
    <section className="space-y-6 rounded-xl border border-white/10 bg-white/2 p-6 text-white shadow-[0_20px_120px_rgba(0,0,0,0.65)] backdrop-blur">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Assignment Engine
        </p>
        <h2 className="text-2xl font-semibold">Assign a user to a variant</h2>
        <p className="text-sm text-zinc-400">
          Sticky assignments ensure each user consistently receives the same
          variant for a given experiment.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
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
            >
              {experiments.map((experiment) => (
                <option key={experiment.id} value={experiment.id}>
                  {experiment.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="user-id">
              User ID
            </label>
            <Input
              id="user-id"
              placeholder="user_123"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="bg-white/5 text-white"
            />
          </div>
        </div>

        {localError && (
          <p className="text-sm text-red-400" role="alert">
            {localError}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-white text-black hover:bg-white/80"
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="mr-2 size-4" />
            )}
            Assign variant
          </Button>
        </div>
      </form>

      {result && selectedExperiment && (
        <div className="space-y-4 rounded-lg border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-3">
            <UserIcon className="size-5 text-zinc-400" />
            <div>
              <p className="text-sm text-zinc-400">User</p>
              <p className="text-lg font-semibold text-white">{result.userId}</p>
            </div>
            <Badge className="ml-auto bg-emerald-500/90 text-emerald-950 dark:text-emerald-50">
              Sticky
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-zinc-400">Experiment</p>
              <p className="font-medium text-white">{selectedExperiment.name}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Variant</p>
              <p className="text-lg font-semibold text-white">
                {result.variant.key}
              </p>
              <p className="text-xs text-zinc-500">
                Weight {result.variant.weight}%
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Created at {new Date(result.createdAt).toLocaleString()}
          </p>
        </div>
      )}

      {selectedExperiment && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">Existing assignments</p>
              <p className="text-lg font-semibold text-white">
                {selectedExperiment.name}
              </p>
            </div>
            {assignmentsListQuery.isFetching && (
              <span className="text-xs text-zinc-400">Refreshing…</span>
            )}
          </div>
          <div className="rounded-md border border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="bg-white/5">
                  <TableHead>User ID</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentsListQuery.data?.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.userId}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-white">
                        {assignment.variant.key}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {assignment.variant.weight}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-zinc-400">
                      {new Date(assignment.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {assignmentsListQuery.data?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-8 text-center text-sm text-zinc-500"
                    >
                      No assignments yet. Assign a user above to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
