import { type RouterOutputs } from "~/trpc/react";

export type Experiment = RouterOutputs["experiments"]["list"][number];
export type Variant = RouterOutputs["variants"]["list"][number];

export type EditableVariant = {
  id?: string;
  key: string;
  weight: number | "";
};
