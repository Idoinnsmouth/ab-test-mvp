import { type RouterOutputs } from "~/trpc/react";

import { type ExperimentStatus as SchemaExperimentStatus } from "./schemas";

export type Experiment = RouterOutputs["experiments"]["list"][number];
export type ExperimentStatus = SchemaExperimentStatus;
