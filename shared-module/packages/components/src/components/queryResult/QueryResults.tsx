"use client"

import React from "react"

import { AnimatedQueryFrame, type AnimatedQueryFrameProps } from "./AnimatedQueryFrame"
import {
  getMultiQueryState,
  isQueryDataTupleEmpty,
  type QueryTuple,
  type SuccessData,
} from "./queryResultState"
import type { ThemeMode } from "./queryResultStyles"

export type QueryResultsProps<E, TQueries extends QueryTuple<E>> = {
  queries: TQueries
  themeMode: ThemeMode
  renderData: (
    data: { [K in keyof TQueries]: SuccessData<TQueries[K]> },
    queries: TQueries,
  ) => React.ReactNode
  emptyFallback?: React.ReactNode
  treatNullAsEmpty?: boolean
  minHeight?: number
  loadingDelayMs?: number
  renderBlockingError?: AnimatedQueryFrameProps<E>["renderBlockingError"]
  renderStaleError?: AnimatedQueryFrameProps<E>["renderStaleError"]
}

/** Like `QueryResult`, but waits until every query in the tuple has data. */
export function QueryResults<E, TQueries extends QueryTuple<E>>({
  queries,
  themeMode,
  renderData,
  emptyFallback = null,
  treatNullAsEmpty = false,
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
    void Promise.all(queries.map((q) => q.refetch()))
  }

  const dataTuple = state.dataTuple
  const tupleValues: unknown[] = dataTuple
    ? Array.isArray(dataTuple)
      ? [...dataTuple]
      : Object.values(dataTuple as object)
    : []

  const body =
    state.allHaveData && dataTuple
      ? isQueryDataTupleEmpty(tupleValues, treatNullAsEmpty)
        ? emptyFallback
        : renderData(dataTuple, queries)
      : null

  return (
    <AnimatedQueryFrame
      themeMode={themeMode}
      minHeight={minHeight}
      loadingDelayMs={loadingDelayMs}
      initialLoading={state.initialLoading}
      refreshing={state.refreshing}
      blockingError={state.blockingError}
      staleError={state.staleError}
      error={state.error}
      retry={retry}
      renderBlockingError={renderBlockingError}
      renderStaleError={renderStaleError}
    >
      {body}
    </AnimatedQueryFrame>
  )
}
