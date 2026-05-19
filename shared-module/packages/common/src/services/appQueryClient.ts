import { QueryClient } from "@tanstack/react-query"
import { ZodError } from "zod"

import { isAppApiError } from "../errors/AppApiError"

const normalizeIssuePath = (path: unknown): string | undefined => {
  if (Array.isArray(path)) {
    return path
      .map((segment) => {
        if (segment === null || segment === undefined) {
          return String(segment)
        }
        if (typeof segment === "symbol") {
          return segment.toString()
        }
        return String(segment)
      })
      .join(".")
  }
  return undefined
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Set default cache time to almost nothing because caching requests for
      // a long time by default violates the princible of least surprise.
      // Accidentally showing cached data to the user can be undesired
      // for example if the user is supposed to edit the data.
      // If caching is desired, this can be explicitly overriden when using
      // the hooks.
      gcTime: 10,
      // Same applies here too
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        let logPayload: unknown = error
        let shouldStopRetrying = false
        if (error instanceof ZodError) {
          const normalizedIssues = error.issues.map((issue) => {
            const expected = "expected" in issue ? issue.expected : undefined
            const received = "received" in issue ? issue.received : undefined
            const format = "format" in issue ? issue.format : undefined
            return {
              path: normalizeIssuePath(issue.path),
              code: issue.code,
              message: issue.message,
              expected,
              received,
              format,
            }
          })
          logPayload = {
            kind: "zod_validation_error",
            issues: normalizedIssues,
          }
          shouldStopRetrying = true
        }
        if (!shouldStopRetrying && isAppApiError(error)) {
          logPayload = {
            kind: "app_api_error",
            status: error.status,
            type: error.type,
            messageKey: error.messageKey,
            userMessage: error.userMessage,
            detail: error.detail,
            issues: error.issues,
            metadata: error.metadata,
            method: error.method,
            url: error.url,
            rawText: error.rawText,
            error,
          }
        } else if (!shouldStopRetrying) {
          logPayload = { kind: "unknown_error", error }
        }
        console.warn(`Query failed (attempt ${failureCount + 1})`, logPayload)
        if (shouldStopRetrying) {
          return false
        }
        // Don't want to retry any client errors (4XX) -- it just gives the impression of slowness.

        const statusCode: number | undefined = isAppApiError(error)
          ? (error.status ?? undefined)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any)?.request?.status ?? (error as any)?.status)
        if (statusCode && Math.floor(statusCode / 100) === 4) {
          if (statusCode === 429) {
            return failureCount < 1
          }
          console.info(
            `Not retrying because the status code indicated the error was a client error (${statusCode})`,
          )
          return false
        }
        const willRetry = failureCount < 3
        if (willRetry) {
          console.info(`Retrying... (${statusCode})`)
        } else {
          console.info(`Maximum number of retries reached. Not retrying anymore. (${statusCode})`)
        }
        return willRetry
      },
      retryDelay: (attemptIndex, error) => {
        const defaultRetry = Math.min(1000 * 2 ** attemptIndex, 30000)
        if (isAppApiError(error) && error.status === 429 && error.retryAfterSeconds !== null) {
          return Math.max(error.retryAfterSeconds * 1000, defaultRetry)
        }

        return defaultRetry
      },
    },
  },
})
