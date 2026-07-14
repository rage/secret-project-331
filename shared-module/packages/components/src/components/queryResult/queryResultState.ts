import type { UseQueryResult } from "@tanstack/react-query"

export type RetryFn = () => void

export type AnyQuery<E = unknown> = UseQueryResult<unknown, E>
export type QueryTuple<E = unknown> = readonly AnyQuery<E>[]
export type SuccessData<Q> = Q extends UseQueryResult<infer T, unknown> ? T : never

export interface SingleQueryState<T, E> {
  hasData: boolean
  data?: T
  initialLoading: boolean
  refreshing: boolean
  blockingError: boolean
  staleError: boolean
  error?: E
}

export interface MultiQueryState<E, TQueries extends QueryTuple<E>> {
  allHaveData: boolean
  dataTuple?: { [K in keyof TQueries]: SuccessData<TQueries[K]> }
  initialLoading: boolean
  refreshing: boolean
  blockingError: boolean
  staleError: boolean
  error?: E
}

/** Returns a human-readable message for unknown errors. */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      userMessage?: unknown
      detail?: unknown
      message?: unknown
      title?: unknown
      status?: unknown
      retryAfterSeconds?: unknown
      issues?: unknown
    }
    const status =
      typeof maybeError.status === "number" && Number.isFinite(maybeError.status)
        ? maybeError.status
        : null
    const retryAfterSeconds =
      typeof maybeError.retryAfterSeconds === "number" &&
      Number.isFinite(maybeError.retryAfterSeconds)
        ? maybeError.retryAfterSeconds
        : null
    const firstIssue =
      Array.isArray(maybeError.issues) &&
      maybeError.issues.length > 0 &&
      typeof maybeError.issues[0] === "object" &&
      maybeError.issues[0] !== null &&
      "message" in (maybeError.issues[0] as Record<string, unknown>) &&
      typeof (maybeError.issues[0] as Record<string, unknown>).message === "string"
        ? ((maybeError.issues[0] as Record<string, unknown>).message as string)
        : null
    if (typeof maybeError.userMessage === "string" && maybeError.userMessage.trim() !== "") {
      return status !== null ? `${maybeError.userMessage} (HTTP ${status})` : maybeError.userMessage
    }
    if (typeof maybeError.detail === "string" && maybeError.detail.trim() !== "") {
      if (status === 429 && retryAfterSeconds !== null) {
        return `${maybeError.detail} (retry in ${retryAfterSeconds}s)`
      }
      return status !== null ? `${maybeError.detail} (HTTP ${status})` : maybeError.detail
    }
    if (typeof maybeError.message === "string" && maybeError.message.trim() !== "") {
      return status !== null ? `${maybeError.message} (HTTP ${status})` : maybeError.message
    }
    if (typeof maybeError.title === "string" && maybeError.title.trim() !== "") {
      if (firstIssue) {
        return `${maybeError.title}: ${firstIssue}`
      }
      return status !== null ? `${maybeError.title} (HTTP ${status})` : maybeError.title
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/** True when a value counts as “empty” for optional empty UI. */
export function isQueryResultEmpty(value: unknown, treatNullAsEmpty: boolean): boolean {
  if (value === undefined) {
    return true
  }
  if (treatNullAsEmpty && value === null) {
    return true
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return false
}

/**
 * True when **any** tuple entry is empty (`isQueryResultEmpty` per slot).
 * Used by `QueryResults` so one empty array (or null with `treatNullAsEmpty`) selects `emptyFallback`
 * for the **entire** combined render, not mixed partial content.
 */
export function isQueryDataTupleEmpty(
  tuple: readonly unknown[],
  treatNullAsEmpty: boolean,
): boolean {
  return tuple.some((v) => isQueryResultEmpty(v, treatNullAsEmpty))
}

/** Narrows a query result to one that has defined `data`. */
export function hasUsableQueryData<T, E>(
  query: UseQueryResult<T, E>,
): query is UseQueryResult<T, E> & { data: T } {
  return query.data !== undefined
}

/** Derives loading / error flags for a single TanStack Query result. */
export function getSingleQueryState<T, E>(query: UseQueryResult<T, E>): SingleQueryState<T, E> {
  const hasData = hasUsableQueryData(query)
  return {
    hasData,
    data: hasData ? query.data : undefined,
    initialLoading: query.isFetching && !hasData,
    refreshing: hasData && query.isFetching,
    blockingError: query.isError && !hasData,
    staleError: query.isError && hasData,
    error: query.error ?? undefined,
  }
}

function getDataTupleFromLoadedQueries<TQueries extends readonly AnyQuery[]>(queries: TQueries) {
  return queries.map((q) => q.data) as {
    [K in keyof TQueries]: SuccessData<TQueries[K]>
  }
}

/** Derives loading / error flags for multiple TanStack Query results. */
export function getMultiQueryState<E, TQueries extends QueryTuple<E>>(
  queries: TQueries,
): MultiQueryState<E, TQueries> {
  type Row = UseQueryResult<unknown, E>
  const list = queries as unknown as readonly Row[]

  const allHaveData = list.length > 0 && list.every((q) => q.data !== undefined)
  const blockingErr = list.find((q) => q.data === undefined && q.isError)
  const staleErr = allHaveData ? list.find((q) => q.data !== undefined && q.isError) : undefined
  const error = (blockingErr?.error ?? staleErr?.error) as E | undefined

  // A disabled/idle query in the tuple (no data, not fetching, not error) keeps
  // allHaveData=false, so the combined view stays blank even if other queries
  // succeeded — callers must guard disabled queries before QueryResults,
  // mirroring the single-query contract.
  return {
    allHaveData,
    dataTuple: allHaveData ? getDataTupleFromLoadedQueries(queries) : undefined,
    initialLoading: !allHaveData && list.some((q) => q.data === undefined && q.isFetching),
    refreshing: allHaveData && list.some((q) => q.isFetching),
    blockingError: blockingErr !== undefined,
    staleError: allHaveData && staleErr !== undefined,
    error,
  }
}
