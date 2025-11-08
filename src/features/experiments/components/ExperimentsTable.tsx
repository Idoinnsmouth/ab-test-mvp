import {
  Loader2Icon,
  Edit2Icon,
  Trash2Icon,
  CalendarIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";

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

import { formatter, statusLabels, statusStyles } from "../constants";
import { type Experiment } from "../types";

type ExperimentsTableProps = {
  experiments: Experiment[];
  isFetching: boolean;
  isLoading: boolean;
  onEdit: (experiment: Experiment) => void;
  onDelete: (experiment: Experiment) => void;
  disableDelete: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
};

export function ExperimentsTable({
  experiments,
  isFetching,
  isLoading,
  onEdit,
  onDelete,
  disableDelete,
  onLoadMore,
  hasMore,
  isFetchingNextPage,
}: ExperimentsTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      {
        root,
        rootMargin: "0px 0px 200px 0px",
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, onLoadMore]);

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
        <div
          ref={scrollContainerRef}
          className="max-h-[520px] overflow-y-auto pr-2"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-white/2">
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Strategy</TableHead>
              <TableHead className="text-center">Variants</TableHead>
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
                <TableCell className="text-center text-zinc-100">
                  {experiment._count?.variants ?? 0}
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
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-zinc-400"
                  >
                    No experiments yet. Create your first test to get started.
                  </TableCell>
                </TableRow>
              )}
              {isFetchingNextPage && experiments.length > 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center">
                    <span className="flex items-center justify-center gap-2 text-xs text-zinc-400">
                      <Loader2Icon className="size-3 animate-spin" />
                      Loading more experiments…
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {hasMore && (
                <TableRow ref={sentinelRef} aria-hidden className="h-2">
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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
