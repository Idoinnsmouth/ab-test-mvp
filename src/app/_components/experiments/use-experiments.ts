import { useEffect, useState } from "react";

import { api } from "~/trpc/react";

export function useExperiments() {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(handle);
  }, [search]);

  const queryInput =
    debouncedSearch.length > 0 ? { search: debouncedSearch } : undefined;

  const queryResult = api.experiments.list.useQuery(queryInput, {
    placeholderData: (prev) => prev ?? [],
  });

  const deleteMutation = api.experiments.delete.useMutation({
    onSuccess: async () => {
      await utils.experiments.list.invalidate();
    },
  });

  const requestDelete = (id: string) => deleteMutation.mutate({ id });

  return {
    search,
    setSearch,
    experiments: queryResult.data ?? [],
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    deleteExperiment: requestDelete,
    deletePending: deleteMutation.isPending,
  };
}
