/* eslint-disable i18next/no-literal-string */
import { useQuery, UseQueryOptions } from "@tanstack/react-query"
import { useEffect, useState } from "react"

interface DisabledState {
  state: "disabled"
  data: null
  error: null
  refetch: () => Promise<unknown>
}

interface ErrorState {
  state: "error"
  data: null
  error: Error
  refetch: () => Promise<unknown>
}

interface LoadingState<T> {
  state: "pending"
  data: T | null
  error: Error | null
  refetch: () => Promise<unknown>
}

interface ReadyState<T> {
  state: "ready"
  data: T
  error: null
  refetch: () => Promise<unknown>
}

export type QueryState<T> = DisabledState | LoadingState<T> | ReadyState<T> | ErrorState

/**
 * Expansion of the `useQuery` hook that is only enabled once all values in key are defined. This
 * helps when having to chain multiple queries in a single component.
 */
export default function useStateQuery<T, A1 = unknown, A2 = unknown, A3 = unknown, A4 = unknown>(
  compositeKey: [string, A1?, A2?, A3?, A4?],
  query: (
    a1: NonNullable<A1>,
    a2: NonNullable<A2>,
    a3: NonNullable<A3>,
    a4: NonNullable<A4>,
  ) => Promise<T>,
  options?: UseQueryOptions<T, Error, T>,
): QueryState<T> {
  // All of the elements a1..aN are non null if this check is true.
  const enabled = (options?.enabled ?? true) && compositeKey.every((x) => !!x)
  const [, a1, a2, a3, a4] = compositeKey
  const getQueryState = useQuery<T, Error, T>({
    queryKey: [compositeKey, a1, a2, a3, a4],
    queryFn: () =>
      query(
        a1 as NonNullable<typeof a1>,
        a2 as NonNullable<typeof a2>,
        a3 as NonNullable<typeof a3>,
        a4 as NonNullable<typeof a4>,
      ),
    ...options,
    enabled,
  })
  const [queryState, setQueryState] = useState<QueryState<T>>({
    state: "disabled",
    data: null,
    error: null,
    refetch: getQueryState.refetch,
  })

  useEffect(() => {
    if (!enabled) {
      setQueryState({ state: "disabled", data: null, error: null, refetch: getQueryState.refetch })
    } else if (getQueryState.isError) {
      setQueryState({
        state: "error",
        data: null,
        error: getQueryState.error,
        refetch: getQueryState.refetch,
      })
    } else if (getQueryState.isPending) {
      setQueryState({
        state: "pending",
        data: null,
        error: null,
        refetch: getQueryState.refetch,
      })
    } else if (getQueryState.isSuccess) {
      setQueryState({
        state: "ready",
        data: getQueryState.data,
        error: null,
        refetch: getQueryState.refetch,
      })
    }
  }, [
    getQueryState.data,
    enabled,
    getQueryState.error,
    getQueryState.isPending,
    getQueryState.refetch,
    getQueryState.isError,
    getQueryState.isSuccess,
  ])

  return queryState
}
