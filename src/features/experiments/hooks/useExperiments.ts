import { useEffect, useState } from "react";

import { api, type RouterInputs } from "~/trpc/react";

import { type ExperimentStatus } from "../types";

type ListInput = RouterInputs["experiments"]["list"];

export function useExperiments() {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExperimentStatus | "all">(
    "all",
  );

  useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(handle);
  }, [search]);

  const listInput: ListInput = {};
  if (debouncedSearch.length > 0) {
    listInput.search = debouncedSearch;
  }
  if (statusFilter !== "all") {
    listInput.status = [statusFilter];
  }
  const queryInput = Object.keys(listInput).length > 0 ? listInput : undefined;

  const queryResult = api.experiments.list.useQuery(queryInput, {
    placeholderData: (prev) => prev ?? [],
  });

  const deleteMutation = api.experiments.delete.useMutation({
    onMutate: async ({ id }) => {
      const input = queryInput;
      await utils.experiments.list.cancel(input);
      const previous = utils.experiments.list.getData(input);
      utils.experiments.list.setData(input, (prev) =>
        prev?.filter((experiment) => experiment.id !== id) ?? prev,
      );
      return { previous, input };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        utils.experiments.list.setData(context.input, context.previous);
      }
    },
    onSettled: async () => {
      await utils.experiments.list.invalidate();
    },
  });

  const requestDelete = (id: string) => deleteMutation.mutate({ id });

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    experiments: queryResult.data ?? [],
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    deleteExperiment: requestDelete,
    deletePending: deleteMutation.isPending,
  };
}
