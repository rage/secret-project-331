"use client"

import React from "react"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"

/**
 * Shared `renderBlockingError` / `renderStaleError` render props for `QueryResult` / `QueryResults`.
 *
 * Many call sites pass an identical inline closure that renders the read-only `ErrorBanner`.
 * These helpers dedup that read-only error UI. The parameter type mirrors the query result's
 * `FallbackArgs<unknown>` (`{ error, retry }`) so TypeScript accepts them as
 * `renderBlockingError` / `renderStaleError`. `retry` is intentionally unused here.
 */

export const renderReadOnlyBlockingError = ({
  error,
}: {
  error: unknown
  retry: () => void
}): React.ReactNode => <ErrorBanner error={error} variant="readOnly" />

export const renderReadOnlyStaleError = ({
  error,
}: {
  error: unknown
  retry: () => void
}): React.ReactNode => <ErrorBanner error={error} variant="readOnly" />
