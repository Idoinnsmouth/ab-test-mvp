import { useEffect, useMemo, useState } from "react";

import { api, type RouterInputs } from "~/trpc/react";

import { type ExperimentStatus } from "../types";

type ListInput = RouterInputs["experiments"]["list"];
const PAGE_SIZE = 20;

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

  const baseFilters = useMemo<ListInput>(() => {
    const filters: ListInput = {};
    if (debouncedSearch.length > 0) {
      filters.search = debouncedSearch;
    }
    if (statusFilter !== "all") {
      filters.status = [statusFilter];
    }
    return filters;
  }, [debouncedSearch, statusFilter]);

  const infiniteInput = useMemo(
    () => ({
      ...baseFilters,
      limit: PAGE_SIZE,
    }),
    [baseFilters],
  );

  const queryResult = api.experiments.list.useInfiniteQuery(infiniteInput, {
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const deleteMutation = api.experiments.delete.useMutation({
    onMutate: async ({ id }) => {
      const input = infiniteInput;
      await utils.experiments.list.cancel(input);
      const previous = utils.experiments.list.getInfiniteData(input);
      utils.experiments.list.setInfiniteData(input, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.filter((experiment) => experiment.id !== id),
          })),
        };
      });
      return { previous, input };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        utils.experiments.list.setInfiniteData(context.input, context.previous);
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
    experiments:
      queryResult.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isFetchingNextPage: queryResult.isFetchingNextPage,
    hasNextPage: queryResult.hasNextPage ?? false,
    fetchNextPage: queryResult.fetchNextPage,
    error: queryResult.error,
    deleteExperiment: requestDelete,
    deletePending: deleteMutation.isPending,
  };
}
