"use client"

import { atom, createStore, useAtomValue } from "jotai"
import { atomFamily } from "jotai-family"

export type DynamicImportStatus =
  | {
      state: "loading"
      startedAt: number
      retryAttempt?: number
      lastErrorMessage?: string
      maxAttempts?: number
      online?: boolean
    }
  | { state: "import_rejected"; startedAt: number; errorMessage: string }
  | { state: "invalid_export"; startedAt: number; details: string }
  | { state: "import_resolved_pending_commit"; startedAt: number; resolvedAt: number }
  | { state: "committed"; startedAt: number; committedAt: number }
  | { state: "render_error"; startedAt: number; errorMessage: string }

const DYNAMIC_IMPORT_STATUS_TTL_MS = 10 * 60 * 1000
export const DYNAMIC_IMPORT_MAX_ATTEMPTS = 3

export const DYNAMIC_IMPORT_STATE_LOADING = "loading" as const
export const DYNAMIC_IMPORT_STATE_IMPORT_REJECTED = "import_rejected" as const
export const DYNAMIC_IMPORT_STATE_INVALID_EXPORT = "invalid_export" as const
export const DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT =
  "import_resolved_pending_commit" as const
export const DYNAMIC_IMPORT_STATE_COMMITTED = "committed" as const
export const DYNAMIC_IMPORT_STATE_RENDER_ERROR = "render_error" as const

const dynamicImportStatusFamily = atomFamily((_id: string) =>
  atom<DynamicImportStatus | undefined>(undefined),
)

// Dedicated store so dynamic import tracking does not depend on app-level Jotai Providers.
export const dynamicImportStore = createStore()

dynamicImportStatusFamily.setShouldRemove((createdAt /* ms */) => {
  // Best-effort cleanup policy from jotai-family. This check runs when the family
  // is accessed again, so it is not guaranteed to remove stale atoms immediately.
  return Date.now() - createdAt > DYNAMIC_IMPORT_STATUS_TTL_MS
})

/**
 * Imperatively update dynamic import status for a given id.
 */
export const setDynamicImportStatus = (id: string, status: DynamicImportStatus): void => {
  dynamicImportStore.set(dynamicImportStatusFamily(id), status)
}

/**
 * Imperatively read dynamic import status for a given id.
 */
export const getDynamicImportStatus = (id: string): DynamicImportStatus | undefined =>
  dynamicImportStore.get(dynamicImportStatusFamily(id))

/**
 * Subscribe to dynamic import status changes for a given id.
 */
export const useDynamicImportStatus = (id: string) =>
  useAtomValue(dynamicImportStatusFamily(id), { store: dynamicImportStore })

/**
 * Schedule removal of dynamic import status for a given id after the TTL has elapsed.
 * This explicit timer is the reliable cleanup path for committed imports.
 */
export const scheduleDynamicImportStatusCleanup = (id: string): void => {
  setTimeout(() => {
    dynamicImportStatusFamily.remove(id)
  }, DYNAMIC_IMPORT_STATUS_TTL_MS)
}
