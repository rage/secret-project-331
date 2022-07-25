import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Set default cache time to almost nothing because caching requests for
      // a long time by default violates the princible of least surprise.
      // Accidentally showing cached data to the user can be undesired
      // for example if the user is supposed to edit the data.
      // If caching is desired, this can be explicitly overriden when using
      // the hooks.
      cacheTime: 10,
      // Same applies here too
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        // Don't want to retry any client errors (4XX) -- it just gives the impression of slowness.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode: number | undefined = (error as any)?.status
        if (statusCode && Math.floor(statusCode / 100) === 4) {
          return false
        }
        return failureCount < 3
      },
    },
  },
})
