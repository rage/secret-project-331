import { reportErrorOccurrence, setDefaultErrorReportingService } from "./reportErrorOccurrence"

let installed = false

function sanitizedPath(): string {
  return window.location.pathname
}

export function installGlobalErrorReporting(options?: { service?: string }): void {
  if (typeof window === "undefined") {
    return
  }
  if (installed) {
    return
  }
  installed = true

  if (options?.service) {
    setDefaultErrorReportingService(options.service)
  }

  window.addEventListener("error", (event) => {
    const err = event.error
    const message = err instanceof Error ? err.message : event.message || "Unhandled error"
    const stack = err instanceof Error ? err.stack : undefined

    void reportErrorOccurrence({
      error_source: "frontend",
      message,
      stack_trace: stack ?? null,
      path: sanitizedPath(),
      details: {
        kind: "window-error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined

    void reportErrorOccurrence({
      error_source: "frontend",
      message,
      stack_trace: stack ?? null,
      path: sanitizedPath(),
      details: {
        kind: "unhandledrejection",
      },
    })
  })
}
