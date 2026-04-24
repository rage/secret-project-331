import { type ErrorOccurrenceRequestContext, reportErrorOccurrence } from "./reportErrorOccurrence"

/**
 * Wrap a route handler to add consistent error reporting context.
 * @param handler Route handler to execute (sync or async).
 * @param meta.service Service slug used for reporting.
 * @param meta.operation Optional operation name attached to telemetry details.
 * @returns A function that reports failures with context and rethrows the original error.
 */
export function wrapRouteHandler<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult> | TResult,
  meta: {
    service: string
    operation?: string
  },
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await handler(...args)
    } catch (error) {
      const firstArg = args[0] as
        | {
            headers?: ErrorOccurrenceRequestContext["headers"]
            method?: unknown
            url?: unknown
          }
        | undefined
      const request =
        firstArg && typeof firstArg.url === "string" && typeof firstArg.method === "string"
          ? firstArg
          : null
      const requestContext = request
        ? {
            headers: request.headers,
            url: typeof request.url === "string" ? request.url : null,
          }
        : undefined
      const url = typeof request?.url === "string" ? request.url : null
      const method = typeof request?.method === "string" ? request.method : null

      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined

      void reportErrorOccurrence(
        {
          service: meta.service,
          error_source: "backend",
          message,
          stack_trace: stack ?? null,
          path: url,
          details: {
            kind: "next-route-handler",
            operation: meta.operation ?? null,
            method,
            url,
          },
        },
        {
          requestContext,
        },
      )

      throw error
    }
  }
}
