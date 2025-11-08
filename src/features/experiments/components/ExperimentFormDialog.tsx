import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

import { statusLabels } from "../constants";
import { type Experiment, type ExperimentStatus } from "../types";

type ExperimentFormDialogProps = {
  mode: "create" | "edit";
  experiment?: Experiment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingExperimentNames: string[];
};

type FormValues = {
  name: string;
  status: ExperimentStatus;
  strategy: string;
  startAt: string;
  endAt: string;
};

const defaultFormValues: FormValues = {
  name: "",
  status: "draft",
  strategy: "uniform",
  startAt: "",
  endAt: "",
};

const snakeCaseRegex = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const toDateInputValue = (value?: Date | string | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
};

const fromDateInputValue = (value: string) => (value ? new Date(value) : null);

export function ExperimentFormDialog({
  mode,
  experiment,
  open,
  onOpenChange,
  existingExperimentNames,
}: ExperimentFormDialogProps) {
  const utils = api.useUtils();
  const [formValues, setFormValues] = useState<FormValues>(defaultFormValues);
  const [localError, setLocalError] = useState<string | null>(null);

  const createMutation = api.experiments.create.useMutation({
    onSuccess: async () => {
      await utils.experiments.list.invalidate();
      setFormValues(defaultFormValues);
      onOpenChange(false);
    },
  });

  const updateMutation = api.experiments.update.useMutation({
    onSuccess: async () => {
      await utils.experiments.list.invalidate();
      onOpenChange(false);
    },
  });

  const mutation = mode === "create" ? createMutation : updateMutation;
  const formError = localError ?? mutation.error?.message;

  useEffect(() => {
    if (open) {
      setLocalError(null);
      setFormValues(
        experiment
          ? {
              name: experiment.name,
              status: experiment.status,
              strategy: experiment.strategy,
              startAt: toDateInputValue(experiment.startAt),
              endAt: toDateInputValue(experiment.endAt),
            }
          : defaultFormValues,
      );
    }
  }, [experiment, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    const trimmedName = formValues.name.trim();

    if (!snakeCaseRegex.test(trimmedName)) {
      setLocalError("Use lowercase snake_case for experiment names.");
      return;
    }

    const normalizedExisting = existingExperimentNames.map((name) =>
      name.trim(),
    );
    const isDuplicate = normalizedExisting.some(
      (name) =>
        name === trimmedName &&
        (mode === "create" || name !== experiment?.name?.trim()),
    );
    if (isDuplicate) {
      setLocalError("An experiment with this name already exists.");
      return;
    }

    if (formValues.startAt && formValues.endAt) {
      const start = new Date(formValues.startAt);
      const end = new Date(formValues.endAt);
      if (end < start) {
        setLocalError("End date must be after the start date.");
        return;
      }
    }

    const payload = {
      name: trimmedName,
      status: formValues.status,
      strategy: formValues.strategy.trim(),
      startAt: fromDateInputValue(formValues.startAt),
      endAt: fromDateInputValue(formValues.endAt),
    };

    if (mode === "create") {
      createMutation.mutate(payload);
    } else if (experiment) {
      updateMutation.mutate({ id: experiment.id, ...payload });
    }
  };

  const title = mode === "create" ? "New experiment" : "Edit experiment";
  const description =
    mode === "create"
      ? "Define the core metadata for your experiment."
      : `Update ${experiment?.name ?? "this experiment"} before rollout.`;

  return (
    <DialogContent
      className="bg-zinc-950 text-white"
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="text-zinc-400">
          {description}
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200" htmlFor="name">
            Name
          </label>
          <Input
            id="name"
            value={formValues.name}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
            placeholder="traffic_split_test"
            className="bg-white/5 text-white"
            required
          />
          <p className="text-xs text-zinc-500">
            Lowercase snake_case only. Used as the public identifier.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              value={formValues.status}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  status: event.target.value as ExperimentStatus,
                }))
              }
              className="border-input bg-white/5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 h-9 rounded-md border px-3"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-zinc-200"
              htmlFor="strategy"
            >
              Strategy
            </label>
            <Input
              id="strategy"
              value={formValues.strategy}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  strategy: event.target.value,
                }))
              }
              placeholder="uniform"
              className="bg-white/5 text-white"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-zinc-200"
              htmlFor="startAt"
            >
              Start at
            </label>
            <Input
              id="startAt"
              type="date"
              value={formValues.startAt}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  startAt: event.target.value,
                }))
              }
              className="bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="endAt">
              End at
            </label>
            <Input
              id="endAt"
              type="date"
              value={formValues.endAt}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  endAt: event.target.value,
                }))
              }
              className="bg-white/5 text-white"
            />
          </div>
        </div>

        {formError && <p className="text-sm text-red-400">{formError}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="text-zinc-400 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-white text-black hover:bg-white/80"
            disabled={mutation.isPending}
          >
            {mode === "create" ? "Create" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
