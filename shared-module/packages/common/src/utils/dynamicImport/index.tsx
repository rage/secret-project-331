"use client"

import dynamic from "next/dynamic"
import type { ComponentType } from "react"

import CommitMarker from "./CommitMarker"
import DynamicImportErrorBoundary from "./DynamicImportErrorBoundary"
import { createDynamicImportFallbackModule } from "./DynamicImportFallback"
import LoadingState from "./LoadingState"
import {
  DYNAMIC_IMPORT_MAX_ATTEMPTS,
  DYNAMIC_IMPORT_STATE_COMMITTED,
  DYNAMIC_IMPORT_STATE_IMPORT_REJECTED,
  DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT,
  DYNAMIC_IMPORT_STATE_INVALID_EXPORT,
  DYNAMIC_IMPORT_STATE_LOADING,
  DYNAMIC_IMPORT_STATE_RENDER_ERROR,
  getDynamicImportStatus,
  scheduleDynamicImportStatusCleanup,
  setDynamicImportStatus,
} from "./dynamicImportStore"
import {
  importWithRetry,
  isChunkLoadError,
  isProbablyReactComponent,
  withTimeout,
} from "./dynamicImportUtils"

const DYNAMIC_IMPORT_ID_PREFIX = "dyn_"

const DYNAMIC_IMPORT_MISSING_DEFAULT_EXPORT_DETAILS = "Module did not have a default export."
const DYNAMIC_IMPORT_MISSING_DEFAULT_EXPORT_ERROR = "Dynamic import module missing default export"
const DYNAMIC_IMPORT_INVALID_COMPONENT_DETAILS =
  "Default export did not look like a React component (function, class, or React wrapper)."
const DYNAMIC_IMPORT_INVALID_COMPONENT_ERROR =
  "Dynamic import default export is not a React component"

let counter = 0
const nextId = (): string => `${DYNAMIC_IMPORT_ID_PREFIX}${Date.now()}_${++counter}`

const logDynamicImportInfo = (id: string, message: string, extra?: unknown): void => {
  console.info("[dynamicImport]", { id, message, extra })
}

const logDynamicImportError = (id: string, message: string, error: unknown): void => {
  console.error("[dynamicImport]", { id, message, error })
}

/**
 * Returns the current online status when available in the browser.
 */
const getNavigatorOnlineStatus = (): boolean | undefined => {
  if (typeof navigator === "undefined") {
    return undefined
  }
  return navigator.onLine
}

/**
 * A utility function for creating dynamically imported components with a loading state.
 * This is a wrapper around Next.js's dynamic import that provides a consistent loading UI
 * and disables server-side rendering.
 *
 * @param importFn - A function that returns a Promise resolving to a module with a default export
 * @returns A dynamically imported component
 *
 * @example
 * ```tsx
 * const MyComponent = dynamicImport(() => import('./MyComponent'))
 * ```
 */
export interface DynamicImportDeps {
  now?: () => number
  reload?: () => void
  getOnline?: () => boolean | undefined
  log?: (id: string, message: string, extra?: unknown) => void
  logError?: (id: string, message: string, error: unknown) => void
  sleep?: (ms: number) => Promise<void>
  idFactory?: () => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dynamicFn?: (loader: any, opts: any) => any
}

const dynamicImport = <P extends object = Record<string, never>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  deps: DynamicImportDeps = {},
) => {
  const {
    now = () => Date.now(),
    reload = () => {
      if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
        window.location.reload()
      }
    },
    getOnline = getNavigatorOnlineStatus,
    log = logDynamicImportInfo,
    logError = logDynamicImportError,
    sleep,
    idFactory = nextId,
    dynamicFn = dynamic,
  } = deps

  const id = idFactory()
  let Wrapped: ComponentType<P> | null = null
  let wrappedImportPromise: Promise<{ default: ComponentType<P> }> | null = null
  let noCommitTimeoutId: ReturnType<typeof setTimeout> | null = null

  /**
   * Runs the dynamic import and updates tracking state for this instance.
   */
  const runImport = async (): Promise<{ default: ComponentType<P> }> => {
    const startedAt = now()
    const online = getOnline()
    setDynamicImportStatus(id, { state: DYNAMIC_IMPORT_STATE_LOADING, startedAt, online })

    log(id, "dynamic-import-started", { online })

    try {
      const module = await importWithRetry(
        () =>
          withTimeout(
            importFn(),
            15_000,
            // eslint-disable-next-line i18next/no-literal-string
            "Dynamic import timed out",
          ),
        DYNAMIC_IMPORT_MAX_ATTEMPTS,
        1_000,
        (attempt, error) => {
          if (isChunkLoadError(error) && typeof reload === "function") {
            reload()
            throw error
          }

          const message = error instanceof Error ? error.message : String(error)
          setDynamicImportStatus(id, {
            state: DYNAMIC_IMPORT_STATE_LOADING,
            startedAt,
            retryAttempt: attempt,
            lastErrorMessage: message,
            maxAttempts: DYNAMIC_IMPORT_MAX_ATTEMPTS,
          })

          log(id, `dynamic-import-retry-${attempt}`, error)
        },
        sleep,
      )

      if (!module || !("default" in module)) {
        setDynamicImportStatus(id, {
          state: DYNAMIC_IMPORT_STATE_INVALID_EXPORT,
          startedAt,
          details: DYNAMIC_IMPORT_MISSING_DEFAULT_EXPORT_DETAILS,
        })
        // eslint-disable-next-line i18next/no-literal-string
        logError(id, "dynamic-import-missing-default-export", {
          error: new Error(DYNAMIC_IMPORT_MISSING_DEFAULT_EXPORT_ERROR),
        })
        throw new Error(DYNAMIC_IMPORT_MISSING_DEFAULT_EXPORT_ERROR)
      }

      if (!isProbablyReactComponent(module.default)) {
        setDynamicImportStatus(id, {
          state: DYNAMIC_IMPORT_STATE_INVALID_EXPORT,
          startedAt,
          details: DYNAMIC_IMPORT_INVALID_COMPONENT_DETAILS,
        })
        // eslint-disable-next-line i18next/no-literal-string
        logError(id, "dynamic-import-invalid-component", {
          error: new Error(DYNAMIC_IMPORT_INVALID_COMPONENT_ERROR),
        })
        throw new Error(DYNAMIC_IMPORT_INVALID_COMPONENT_ERROR)
      }

      const resolvedAt = now()
      setDynamicImportStatus(id, {
        state: DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT,
        startedAt,
        resolvedAt,
      })

      log(id, "dynamic-import-resolved-waiting-for-commit")

      noCommitTimeoutId = setTimeout(() => {
        const current = getDynamicImportStatus(id)
        // If status is already cleaned up, the component likely unmounted and this
        // warning would be a false positive.
        if (!current) {
          return
        }
        if (current.state === DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT) {
          logError(id, "dynamic-import-resolved-but-no-commit-after-5s", current)
        }
      }, 5_000)

      const Original = module.default
      const OriginalComponent = Original as ComponentType<Record<string, unknown>>

      const WrappedComponent = (props: P) => {
        return (
          <DynamicImportErrorBoundary
            onError={(error) => {
              const message = error instanceof Error ? error.message : String(error)
              setDynamicImportStatus(id, {
                state: DYNAMIC_IMPORT_STATE_RENDER_ERROR,
                startedAt,
                errorMessage: message,
              })
              // eslint-disable-next-line i18next/no-literal-string
              logError(id, "dynamic-import-render-error", error)
            }}
          >
            <CommitMarker
              onCommit={() => {
                const current = getDynamicImportStatus(id)
                if (current?.state === DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT) {
                  setDynamicImportStatus(id, {
                    state: DYNAMIC_IMPORT_STATE_COMMITTED,
                    startedAt: current.startedAt,
                    committedAt: now(),
                  })
                  if (noCommitTimeoutId !== null) {
                    clearTimeout(noCommitTimeoutId)
                    noCommitTimeoutId = null
                  }

                  log(id, "dynamic-import-committed")
                  scheduleDynamicImportStatusCleanup(id)
                }
              }}
            />
            <OriginalComponent {...(props as Record<string, unknown>)} />
          </DynamicImportErrorBoundary>
        )
      }
      const originalMeta = Original as { displayName?: string; name?: string }
      WrappedComponent.displayName = `DynamicImport(${
        originalMeta.displayName || originalMeta.name || "Anonymous"
      })`

      Wrapped = WrappedComponent as ComponentType<P>
      return { default: Wrapped }
    } catch (error) {
      if (noCommitTimeoutId !== null) {
        clearTimeout(noCommitTimeoutId)
        noCommitTimeoutId = null
      }
      if (isChunkLoadError(error)) {
        log(id, "dynamic-import-chunk-load-reload-triggered")
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      const current = getDynamicImportStatus(id)
      if (
        !current ||
        current.state === DYNAMIC_IMPORT_STATE_LOADING ||
        current.state === DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT
      ) {
        setDynamicImportStatus(id, {
          state: DYNAMIC_IMPORT_STATE_IMPORT_REJECTED,
          startedAt,
          errorMessage: message,
        })
      }
      // eslint-disable-next-line i18next/no-literal-string
      logError(id, "dynamic-import-or-wrapping-failed", error)
      throw error
    }
  }

  const wrappedImport = (): Promise<{ default: ComponentType<P> }> => {
    if (Wrapped) {
      return Promise.resolve({ default: Wrapped })
    }
    if (!wrappedImportPromise) {
      wrappedImportPromise = runImport().catch(() => {
        // Intentionally reset so a future remount can retry the import.
        wrappedImportPromise = null
        return createDynamicImportFallbackModule(id) as { default: ComponentType<P> }
      })
    }
    return wrappedImportPromise
  }

  return dynamicFn(wrappedImport, {
    ssr: false,
    loading: () => <LoadingState debugId={id} />,
  })
}

export default dynamicImport
