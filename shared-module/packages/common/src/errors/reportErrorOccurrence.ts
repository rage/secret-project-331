export type ErrorSource = "backend" | "frontend"

export type ErrorOccurrenceReport = {
  service?: string
  error_source?: ErrorSource
  message: string
  stack_trace?: string | null
  path?: string | null
  app_version?: string | null
  details?: unknown
}

const ERRORS_ENDPOINT_PATH = "/api/v0/errors"

let defaultServiceSlug: string | null = null

export function setDefaultErrorReportingService(service: string): void {
  const trimmed = service.trim()
  defaultServiceSlug = trimmed ? trimmed : null
}

function resolveServiceSlug(explicit?: string): string {
  const fromArg = explicit?.trim()
  if (fromArg) {
    return fromArg
  }

  const fromDefault = defaultServiceSlug?.trim()
  if (fromDefault) {
    return fromDefault
  }

  const fromEnv =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SERVICE_SLUG?.trim() : undefined
  if (fromEnv) {
    return fromEnv
  }

  return "unknown"
}

function resolveUrlForEnvironment(): string | null {
  if (typeof window !== "undefined") {
    return ERRORS_ENDPOINT_PATH
  }
  if (typeof process === "undefined") {
    return null
  }
  const baseUrl =
    process.env.ERRORS_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_ERRORS_BASE_URL?.trim() ||
    process.env.SERVICE_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (!baseUrl) {
    return null
  }
  return new URL(ERRORS_ENDPOINT_PATH, baseUrl).toString()
}

export async function reportErrorOccurrence(report: ErrorOccurrenceReport): Promise<void> {
  try {
    const url = resolveUrlForEnvironment()
    if (!url) {
      return
    }

    const service = resolveServiceSlug(report.service)

    const path =
      report.path ?? (typeof window !== "undefined" ? window.location.pathname : null) ?? undefined

    const payload = {
      service,
      error_source: report.error_source,
      message: report.message,
      stack_trace: report.stack_trace ?? undefined,
      path,
      app_version: report.app_version ?? undefined,
      details: report.details ?? undefined,
    }

    const body = JSON.stringify(payload)

    // Best-effort fire-and-forget for crash contexts.
    if (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "sendBeacon" in navigator
    ) {
      try {
        const blob = new Blob([body], { type: "text/plain" })
        if (navigator.sendBeacon(url, blob) === true) {
          return
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("reportErrorOccurrence sendBeacon fallback", error)
        }
        // Fall back to fetch below.
      }
    }

    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      keepalive: true,
      credentials: "include",
    })
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("reportErrorOccurrence failed", error)
    }
    // Reporting must never throw.
  }
}
