"use client";

import { useEffect, useState } from "react";
import {
  CalendarIcon,
  Edit2Icon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type Experiment = RouterOutputs["experiments"]["list"][number];
type ExperimentStatus = Experiment["status"];

type FormValues = {
  name: string;
  status: ExperimentStatus;
  strategy: string;
  startAt: string;
  endAt: string;
};

const statusLabels: Record<ExperimentStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

const statusStyles: Record<ExperimentStatus, string> = {
  draft: "bg-zinc-700 text-white",
  active: "bg-emerald-500/90 text-emerald-950 dark:text-emerald-50",
  paused: "bg-yellow-500/80 text-yellow-950 dark:text-yellow-50",
  completed: "bg-rose-600 text-white",
};

const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const defaultFormValues: FormValues = {
  name: "",
  status: "draft",
  strategy: "uniform",
  startAt: "",
  endAt: "",
};

const toDateInputValue = (value?: Date | string | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
};

const fromDateInputValue = (value: string) => (value ? new Date(value) : null);

function useExperiments() {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(handle);
  }, [search]);

  const queryInput =
    debouncedSearch.length > 0 ? { search: debouncedSearch } : undefined;

  const queryResult = api.experiments.list.useQuery(queryInput, {
    placeholderData: (prev) => prev ?? [],
  });

  const deleteMutation = api.experiments.delete.useMutation({
    onSuccess: async () => {
      await utils.experiments.list.invalidate();
    },
  });

  const requestDelete = (id: string) => deleteMutation.mutate({ id });

  return {
    search,
    setSearch,
    experiments: queryResult.data ?? [],
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    deleteExperiment: requestDelete,
    deletePending: deleteMutation.isPending,
  };
}

export function ExperimentsClient() {
  const {
    search,
    setSearch,
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
        />
      </Dialog>
    </section>
  );
}

type ExperimentsTableProps = {
  experiments: Experiment[];
  isFetching: boolean;
  isLoading: boolean;
  onEdit: (experiment: Experiment) => void;
  onDelete: (experiment: Experiment) => void;
  disableDelete: boolean;
};

function ExperimentsTable({
  experiments,
  isFetching,
  isLoading,
  onEdit,
  onDelete,
  disableDelete,
}: ExperimentsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          Showing {experiments.length} experiment
          {experiments.length === 1 ? "" : "s"}
        </span>
        {isFetching && (
          <span className="flex items-center gap-1 text-zinc-300">
            <Loader2Icon className="size-3 animate-spin" />
            Refreshing
          </span>
        )}
      </div>
      <div className="rounded-lg border border-white/10 bg-black/20">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/2">
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {experiments.map((experiment) => (
              <TableRow key={experiment.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-white">
                      {experiment.name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Updated {formatter.format(experiment.updatedAt)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "capitalize text-xs font-semibold",
                      statusStyles[experiment.status],
                    )}
                  >
                    {statusLabels[experiment.status]}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize text-zinc-200">
                  {experiment.strategy}
                </TableCell>
                <TableCell>
                  <ScheduleDisplay experiment={experiment} />
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white hover:bg-white/5"
                    onClick={() => onEdit(experiment)}
                  >
                    <Edit2Icon className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-500"
                    onClick={() => onDelete(experiment)}
                    disabled={disableDelete}
                  >
                    <Trash2Icon className="size-3.5" />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && experiments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-zinc-400">
                  No experiments yet. Create your first test to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ScheduleDisplay({ experiment }: { experiment: Experiment }) {
  if (!experiment.startAt && !experiment.endAt) {
    return <span className="text-zinc-500">No schedule</span>;
  }

  if (experiment.startAt && experiment.endAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <CalendarIcon className="size-3 text-zinc-500" />
        {formatter.format(experiment.startAt)}&nbsp;–&nbsp;
        {formatter.format(experiment.endAt)}
      </div>
    );
  }

  if (experiment.startAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <CalendarIcon className="size-3 text-zinc-500" />
        Starts {formatter.format(experiment.startAt)}
      </div>
    );
  }

  if (!experiment.endAt) {
    return <span className="text-zinc-500">No schedule</span>;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-300">
      <CalendarIcon className="size-3 text-zinc-500" />
      Ends {formatter.format(experiment.endAt)}
    </div>
  );
}

type ExperimentFormDialogProps = {
  mode: "create" | "edit";
  experiment?: Experiment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ExperimentFormDialog({
  mode,
  experiment,
  open,
  onOpenChange,
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

    if (formValues.startAt && formValues.endAt) {
      const start = new Date(formValues.startAt);
      const end = new Date(formValues.endAt);
      if (end < start) {
        setLocalError("End date must be after the start date.");
        return;
      }
    }

    const payload = {
      name: formValues.name.trim(),
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
    <DialogContent className="bg-zinc-950 text-white" onOpenAutoFocus={(event) => event.preventDefault()}>
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
            {mutation.isPending && (
              <Loader2Icon className="size-4 animate-spin" />
            )}
            {mode === "create" ? "Create experiment" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
