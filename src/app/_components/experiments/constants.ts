import { type ExperimentStatus } from "./types";

export const statusLabels: Record<ExperimentStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const statusStyles: Record<ExperimentStatus, string> = {
  draft: "bg-zinc-700 text-white",
  active: "bg-emerald-500/90 text-emerald-950 dark:text-emerald-50",
  paused: "bg-yellow-500/80 text-yellow-950 dark:text-yellow-50",
  completed: "bg-rose-600 text-white",
};

export const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
