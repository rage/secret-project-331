import { reportErrorOccurrence } from "./reportErrorOccurrence"

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
      const request = args[0] instanceof Request ? args[0] : null
      const url = request?.url ?? null
      const method = request?.method ?? null

      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined

      void reportErrorOccurrence({
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
      })

      throw error
    }
  }
}
