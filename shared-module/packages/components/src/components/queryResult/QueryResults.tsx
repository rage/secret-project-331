"use client"

import React from "react"

import { omitUndefined } from "../../lib/utils/nullability"
import { AnimatedQueryFrame, type AnimatedQueryFrameProps } from "./AnimatedQueryFrame"
import {
  getMultiQueryState,
  isQueryDataTupleEmpty,
  type QueryTuple,
  type SuccessData,
} from "./queryResultState"
import type { ThemeMode } from "./queryResultStyles"

export interface QueryResultsProps<E, TQueries extends QueryTuple<E>> {
  queries: TQueries
  themeMode?: ThemeMode
  renderData: (
    data: { [K in keyof TQueries]: SuccessData<TQueries[K]> },
    queries: TQueries,
  ) => React.ReactNode
  emptyFallback?: React.ReactNode
  treatNullAsEmpty?: boolean
  treatEmptyAsData?: boolean
  minHeight?: number
  loadingDelayMs?: number
  renderBlockingError?: AnimatedQueryFrameProps<E>["renderBlockingError"]
  renderStaleError?: AnimatedQueryFrameProps<E>["renderStaleError"]
}

/**
 * Like `QueryResult`, but waits until every query in the tuple has data.
 *
 * **`emptyFallback` behavior:** when all queries have data, `isQueryDataTupleEmpty` runs on the tuple.
 * If **any** entry is empty (`[]`, `undefined`, or `null` when `treatNullAsEmpty`), the whole view
 * shows `emptyFallback` instead of `renderData` — not per-query partial UI.
 *
 * **`treatEmptyAsData`:** skips the tuple empty check entirely, so `renderData` also runs when some
 * entry is empty (e.g. `[]`). Use when the normal render already handles emptiness instead of
 * duplicating the renderer in `emptyFallback`. Mutually exclusive with `emptyFallback` /
 * `treatNullAsEmpty`.
 *
 * **Retry (differs from `QueryResult`):** if any query has `isError` (blocking or stale), only those
 * queries are refetched. If none report an error, retry refetches every query in the tuple.
 */
export function QueryResults<E, TQueries extends QueryTuple<E>>({
  queries,
  themeMode = "light",
  renderData,
  emptyFallback = null,
  treatNullAsEmpty = false,
  treatEmptyAsData = false,
  minHeight,
  loadingDelayMs,
  renderBlockingError,
  renderStaleError,
}: QueryResultsProps<E, TQueries>) {
  if (queries.length === 0) {
    return null
  }

  const state = getMultiQueryState<E, TQueries>(queries)
  const retry = () => {
    const errored = queries.filter((q) => q.isError)
    const targets = errored.length > 0 ? errored : queries
    void Promise.all(targets.map((q) => q.refetch()))
  }

  const dataTuple = state.dataTuple
  const tupleValues: unknown[] = dataTuple
    ? Array.isArray(dataTuple)
      ? [...dataTuple]
      : Object.values(dataTuple as object)
    : []

  const body =
    state.allHaveData && dataTuple
      ? !treatEmptyAsData && isQueryDataTupleEmpty(tupleValues, treatNullAsEmpty)
        ? emptyFallback
        : renderData(dataTuple, queries)
      : null

  return (
    <AnimatedQueryFrame
      themeMode={themeMode}
      initialLoading={state.initialLoading}
      refreshing={state.refreshing}
      blockingError={state.blockingError}
      staleError={state.staleError}
      retry={retry}
      {...omitUndefined({ minHeight })}
      {...omitUndefined({ loadingDelayMs })}
      {...omitUndefined({ error: state.error })}
      {...omitUndefined({ renderBlockingError })}
      {...omitUndefined({ renderStaleError })}
    >
      {body}
    </AnimatedQueryFrame>
  )
}
