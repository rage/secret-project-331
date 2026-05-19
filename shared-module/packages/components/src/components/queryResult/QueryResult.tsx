"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import React from "react"

import { AnimatedQueryFrame, type AnimatedQueryFrameProps } from "./AnimatedQueryFrame"
import { getSingleQueryState, isQueryResultEmpty } from "./queryResultState"
import type { ThemeMode } from "./queryResultStyles"

export type QueryResultProps<T, E = unknown> = {
  query: UseQueryResult<T, E>
  themeMode?: ThemeMode
  children: (data: T) => React.ReactNode
  emptyFallback?: React.ReactNode
  treatNullAsEmpty?: boolean
  minHeight?: number
  loadingDelayMs?: number
  renderBlockingError?: AnimatedQueryFrameProps<E>["renderBlockingError"]
  renderStaleError?: AnimatedQueryFrameProps<E>["renderStaleError"]
}

/**
 * Renders `children` with query data, or loading / error / empty states inside `AnimatedQueryFrame`.
 * When `emptyFallback` is set, it replaces `children` if `isQueryResultEmpty(data, treatNullAsEmpty)`.
 *
 * **Retry:** error UI always refetches this single `query`. For multi-query selective retry, use `QueryResults`.
 */
export function QueryResult<T, E = unknown>({
  query,
  themeMode = "light",
  children,
  emptyFallback = null,
  treatNullAsEmpty = false,
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
      ? isQueryResultEmpty(state.data, treatNullAsEmpty)
        ? emptyFallback
        : children(state.data)
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
