import { type RouterOutputs } from "~/trpc/react";

export type Experiment = RouterOutputs["experiments"]["list"][number];
export type ExperimentStatus = Experiment["status"];
