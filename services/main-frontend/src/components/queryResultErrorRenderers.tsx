"use client"

import React from "react"

import { ErrorNotice } from "@/shared-module/components"

/**
 * Shared `renderBlockingError` / `renderStaleError` render props for `QueryResult` / `QueryResults`.
 *
 * Many call sites pass an identical inline closure that renders the read-only `ErrorNotice`.
 * These helpers dedup that read-only error UI. The parameter type mirrors the query result's
 * `FallbackArgs<unknown>` (`{ error, retry }`) so TypeScript accepts them as
 * `renderBlockingError` / `renderStaleError`. `retry` is intentionally unused here.
 */

export const renderReadOnlyBlockingError = ({
  error,
}: {
  error: unknown
  retry: () => void
}): React.ReactNode => <ErrorNotice error={error} />

export const renderReadOnlyStaleError = ({
  error,
}: {
  error: unknown
  retry: () => void
}): React.ReactNode => <ErrorNotice error={error} />
