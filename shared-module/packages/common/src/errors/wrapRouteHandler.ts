import { type ErrorOccurrenceRequestContext, reportErrorOccurrence } from "./reportErrorOccurrence"

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
      const url = typeof request?.url === "string" ? request.url : null
      const method = typeof request?.method === "string" ? request.method : null
      const requestContext = request
        ? {
            headers: request.headers,
            url,
          }
        : undefined
      const pathname =
        url !== null
          ? (() => {
              try {
                return new URL(url).pathname
              } catch {
                return null
              }
            })()
          : null

      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined

      void reportErrorOccurrence(
        {
          service: meta.service,
          error_source: "backend",
          message,
          stack_trace: stack ?? null,
          path: pathname,
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
