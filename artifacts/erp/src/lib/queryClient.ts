import { QueryClient } from "@tanstack/react-query";

/**
 * Singleton QueryClient shared across the app.
 * Exported so non-component code (e.g. auth.tsx logout) can clear
 * cached data on session changes without restructuring the provider tree.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
      // Lists & dashboards: 2-min stale window — enough to avoid refetch storms
      // on fast navigation but fresh enough for operational data.
      staleTime: 2 * 60_000,
      // Keep data in cache for 15 min after component unmounts so back-navigation
      // shows instant results while a background refetch runs.
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      // Show stale data immediately while revalidating in the background
      // (equivalent to SWR's stale-while-revalidate).
      placeholderData: (prev: unknown) => prev,
    },
    mutations: { retry: false },
  },
});

export default queryClient;
