import { skipToken } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import { type Experiment } from "../types";

const EMPTY_EXPERIMENTS: Experiment[] = [];

export function useAssignmentsApi(experimentId?: string, userId?: string) {
  const utils = api.useUtils();
  const experimentsQuery = api.experiments.list.useQuery(
    { limit: 100 },
    {
      placeholderData: (prev) =>
        prev ?? { items: EMPTY_EXPERIMENTS, nextCursor: null },
    },
  );
  const experiments = experimentsQuery.data?.items ?? EMPTY_EXPERIMENTS;

  const trimmedUserId = userId?.trim() ?? "";
  const canLookup = Boolean(experimentId && trimmedUserId.length >= 3);

  const assignmentQuery = api.assignments.get.useQuery(
    canLookup
      ? {
          experimentId: experimentId!,
          userId: trimmedUserId,
        }
      : skipToken,
    {
      enabled: canLookup,
      placeholderData: null,
    },
  );

  const assignMutation = api.assignments.assign.useMutation({
    onSuccess: (data) => {
      void utils.assignments.get.invalidate({
        experimentId: data.experimentId,
        userId: data.userId,
      });
    },
  });

  return {
    experimentsQuery,
    experiments,
    assignmentQuery,
    assignMutation,
    canLookup,
    trimmedUserId,
  };
}
