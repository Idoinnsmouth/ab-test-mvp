import { type RouterOutputs } from "~/trpc/react";

export type Experiment =
  RouterOutputs["experiments"]["list"]["items"][number];
export type AssignmentResult = RouterOutputs["assignments"]["assign"];
