import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { statusLabels, statusStyles, formatter } from "./constants";
import { type Experiment } from "./types";
import { Loader2Icon, Edit2Icon, Trash2Icon, CalendarIcon } from "lucide-react";

type ExperimentsTableProps = {
  experiments: Experiment[];
  isFetching: boolean;
  isLoading: boolean;
  onEdit: (experiment: Experiment) => void;
  onDelete: (experiment: Experiment) => void;
  disableDelete: boolean;
};

export function ExperimentsTable({
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
