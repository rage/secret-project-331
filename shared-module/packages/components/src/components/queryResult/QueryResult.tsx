"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import React from "react"

import { AnimatedQueryFrame, type AnimatedQueryFrameProps } from "./AnimatedQueryFrame"
import { getSingleQueryState, isQueryResultEmpty } from "./queryResultState"
import type { ThemeMode } from "./queryResultStyles"

export interface QueryResultProps<T, E = unknown> {
  query: UseQueryResult<T, E>
  themeMode?: ThemeMode
  children: (data: T) => React.ReactNode
  emptyFallback?: React.ReactNode
  treatNullAsEmpty?: boolean
  treatEmptyAsData?: boolean
  minHeight?: number
  loadingDelayMs?: number
  renderBlockingError?: AnimatedQueryFrameProps<E>["renderBlockingError"]
  renderStaleError?: AnimatedQueryFrameProps<E>["renderStaleError"]
}

/**
 * Renders `children` with query data, or loading / error / empty states inside `AnimatedQueryFrame`.
 * When `emptyFallback` is set, it replaces `children` if `isQueryResultEmpty(data, treatNullAsEmpty)`.
 *
 * **`treatNullAsEmpty`:** routes null data to `emptyFallback`, so `children` never sees null at
 * runtime. The type system cannot express this, so narrow once inside `children` if `T` includes null.
 *
 * **`treatEmptyAsData`:** skips the empty check entirely, so `children` also receives empty data
 * (e.g. `[]`). Use when the normal render already handles emptiness (a zero-row table is valid UI)
 * instead of duplicating the renderer in `emptyFallback`. Mutually exclusive with
 * `emptyFallback` / `treatNullAsEmpty`.
 *
 * **Retry:** error UI always refetches this single `query`. For multi-query selective retry, use `QueryResults`.
 */
export function QueryResult<T, E = unknown>({
  query,
  themeMode = "light",
  children,
  emptyFallback = null,
  treatNullAsEmpty = false,
  treatEmptyAsData = false,
  minHeight,
  loadingDelayMs,
  renderBlockingError,
  renderStaleError,
}: QueryResultProps<T, E>) {
  const state = getSingleQueryState(query)
  const retry = () => {
    void query.refetch()
  }

  const body =
    state.hasData && state.data !== undefined
      ? !treatEmptyAsData && isQueryResultEmpty(state.data, treatNullAsEmpty)
        ? emptyFallback
        : children(state.data)
      : null

  return (
    <AnimatedQueryFrame
      themeMode={themeMode}
      {...(minHeight !== undefined ? { minHeight } : {})}
      {...(loadingDelayMs !== undefined ? { loadingDelayMs } : {})}
      initialLoading={state.initialLoading}
      refreshing={state.refreshing}
      blockingError={state.blockingError}
      staleError={state.staleError}
      {...(state.error !== undefined ? { error: state.error } : {})}
      retry={retry}
      {...(renderBlockingError !== undefined ? { renderBlockingError } : {})}
      {...(renderStaleError !== undefined ? { renderStaleError } : {})}
    >
      {body}
    </AnimatedQueryFrame>
  )
}
