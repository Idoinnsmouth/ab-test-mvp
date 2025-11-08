import { skipToken } from "@tanstack/react-query";
import { useMemo } from "react";

import { api } from "~/trpc/react";
import { type Experiment } from "../types";

const EMPTY_EXPERIMENTS: Experiment[] = [];

export function useAssignmentsApi(experimentId?: string, userId?: string) {
  const utils = api.useUtils();
  const experimentsQuery = api.experiments.list.useQuery(undefined, {
    placeholderData: (prev) => prev ?? [],
  });
  const experiments = experimentsQuery.data ?? EMPTY_EXPERIMENTS;

  const trimmedUserId = useMemo(() => userId?.trim() ?? "", [userId]);
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

  const assignmentsListQuery = api.assignments.list.useQuery(
    experimentId ? { experimentId } : skipToken,
    {
      enabled: Boolean(experimentId),
      placeholderData: [],
    },
  );

  const assignMutation = api.assignments.assign.useMutation({
    onSuccess: (data) => {
      void utils.assignments.get.invalidate({
        experimentId: data.experimentId,
        userId: data.userId,
      });
      void utils.assignments.list.invalidate({
        experimentId: data.experimentId,
      });
    },
  });

  return {
    experimentsQuery,
    experiments,
    assignmentQuery,
    assignmentsListQuery,
    assignMutation,
    canLookup,
    trimmedUserId,
  };
}
