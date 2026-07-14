export type ErrorSource = "backend" | "frontend"
export type ErrorOccurrenceTransport = "default" | "exit"
type ErrorOccurrenceRequestHeaders =
  | Headers
  | readonly (readonly [string, string])[]
  | Readonly<Record<string, string>>

export interface ErrorOccurrenceReport {
  service?: string
  error_source?: ErrorSource
  message: string
  stack_trace?: string | null
  path?: string | null
  app_version?: string | null
  details?: unknown
}

export interface ErrorOccurrenceRequestContext {
  headers?: ErrorOccurrenceRequestHeaders | null
  url?: string | URL | null
}

const ERRORS_ENDPOINT_PATH = "/api/v0/errors"
const DEFAULT_INTERNAL_ERRORS_BASE_URL = "http://headless-lms:3001"
const PENDING_ERROR_REPORTS_STORAGE_KEY = "pending_error_occurrence_reports"
const MAX_PENDING_ERROR_REPORTS = 20

interface PendingErrorReportRecord {
  id: string
  body: string
}

let defaultServiceSlug: string | null = null
let pendingFlushTransport: ErrorOccurrenceTransport | null = null
let flushInFlightPromise: Promise<void> | null = null

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

function resolveErrorReportUrlFromRequestContext(
  requestContext?: ErrorOccurrenceRequestContext,
): string | null {
  const requestUrl = requestContext?.url
  if (!requestUrl) {
    return null
  }

  try {
    return new URL(ERRORS_ENDPOINT_PATH, requestUrl).toString()
  } catch {
    return null
  }
}

function resolveUrlForEnvironment(requestContext?: ErrorOccurrenceRequestContext): string | null {
  if (typeof window !== "undefined") {
    return ERRORS_ENDPOINT_PATH
  }
  if (typeof process === "undefined") {
    return resolveErrorReportUrlFromRequestContext(requestContext)
  }
  const baseUrl =
    process.env.ERRORS_BASE_URL?.trim() ||
    resolveErrorReportUrlFromRequestContext(requestContext) ||
    process.env.BASE_URL?.trim() ||
    process.env.PUBLIC_ADDRESS?.trim() ||
    DEFAULT_INTERNAL_ERRORS_BASE_URL
  return new URL(ERRORS_ENDPOINT_PATH, baseUrl).toString()
}

function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined"
}

function toPendingErrorReportRecord(
  value: unknown,
  index: number,
): PendingErrorReportRecord | null {
  if (typeof value === "string") {
    return { id: `legacy-${index}`, body: value }
  }

  if (!value || typeof value !== "object") {
    return null
  }

  const record = value as Partial<PendingErrorReportRecord>
  if (typeof record.body !== "string") {
    return null
  }

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id : `legacy-${index}`,
    body: record.body,
  }
}

function readPendingErrorReports(): PendingErrorReportRecord[] {
  if (!isBrowserEnvironment()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(PENDING_ERROR_REPORTS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.flatMap((item, index) => {
          const report = toPendingErrorReportRecord(item, index)
          return report ? [report] : []
        })
      : []
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("reportErrorOccurrence failed to read pending queue", error)
    }
    return []
  }
}

function writePendingErrorReports(reports: PendingErrorReportRecord[]): void {
  if (!isBrowserEnvironment()) {
    return
  }

  try {
    if (reports.length === 0) {
      window.localStorage.removeItem(PENDING_ERROR_REPORTS_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(PENDING_ERROR_REPORTS_STORAGE_KEY, JSON.stringify(reports))
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("reportErrorOccurrence failed to write pending queue", error)
    }
  }
}

function createPendingErrorReportId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function enqueuePendingErrorReport(body: string): void {
  const queued = readPendingErrorReports()
  queued.push({ id: createPendingErrorReportId(), body })
  writePendingErrorReports(queued.slice(-MAX_PENDING_ERROR_REPORTS))
}

export function clearPendingErrorReports(): void {
  writePendingErrorReports([])
}

function browserLooksOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

function pickForwardedRequestHeaders(
  requestContext?: ErrorOccurrenceRequestContext,
): Record<string, string> | undefined {
  if (!requestContext?.headers) {
    return undefined
  }

  const headersInput = requestContext.headers
  const requestHeaders = new Headers()
  if (headersInput instanceof Headers) {
    headersInput.forEach((value, key) => {
      requestHeaders.set(key, value)
    })
  } else if (Array.isArray(headersInput)) {
    for (const [key, value] of headersInput) {
      requestHeaders.set(key, value)
    }
  } else {
    for (const [key, value] of Object.entries(headersInput)) {
      requestHeaders.set(key, value)
    }
  }

  const forwardedHeaders: Record<string, string> = {}
  for (const headerName of ["authorization", "cookie"]) {
    const headerValue = requestHeaders.get(headerName)
    if (headerValue) {
      forwardedHeaders[headerName] = headerValue
    }
  }

  return Object.keys(forwardedHeaders).length > 0 ? forwardedHeaders : undefined
}

async function sendWithFetch(
  url: string,
  body: string,
  options?: {
    credentials?: RequestInit["credentials"]
    headers?: Record<string, string>
  },
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...options?.headers,
      },
      body,
      keepalive: true,
      credentials: options?.credentials ?? "include",
    })

    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.debug("reportErrorOccurrence fetch rejected response", response.status)
    }

    return response.ok
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("reportErrorOccurrence fetch failed", error)
    }
    return false
  }
}

function sendWithBeacon(url: string, body: string): boolean {
  if (
    !isBrowserEnvironment() ||
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false
  }

  try {
    const blob = new Blob([body], { type: "application/json" })
    return navigator.sendBeacon(url, blob) === true
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("reportErrorOccurrence sendBeacon failed", error)
    }
    return false
  }
}

function coalescePendingFlushTransport(
  transport: ErrorOccurrenceTransport,
  requestedTransport: ErrorOccurrenceTransport | null,
): ErrorOccurrenceTransport {
  if (transport === "exit" || requestedTransport === "exit") {
    return "exit"
  }

  return "default"
}

function removeSentPendingErrorReports(sentIds: ReadonlySet<string>): void {
  if (sentIds.size === 0) {
    return
  }

  const queued = readPendingErrorReports()
  const remaining = queued.filter((report) => !sentIds.has(report.id))

  if (remaining.length !== queued.length) {
    writePendingErrorReports(remaining)
  }
}

async function sendPendingErrorReport(
  url: string,
  report: PendingErrorReportRecord,
  transport: ErrorOccurrenceTransport,
): Promise<boolean> {
  if (transport === "exit" && sendWithBeacon(url, report.body)) {
    return true
  }

  return await sendWithFetch(url, report.body)
}

async function flushPendingErrorOccurrencesOnce(options?: {
  transport?: ErrorOccurrenceTransport
}): Promise<void> {
  try {
    if (!isBrowserEnvironment()) {
      return
    }

    const url = resolveUrlForEnvironment()
    if (!url) {
      return
    }

    const transport = options?.transport ?? "default"
    const pending = readPendingErrorReports()
    if (pending.length === 0) {
      return
    }

    if (transport === "default" && browserLooksOffline()) {
      return
    }

    const sentIds = new Set<string>()
    for (const pendingReport of pending) {
      const sent = await sendPendingErrorReport(url, pendingReport, transport)
      if (sent) {
        sentIds.add(pendingReport.id)
      }
    }
    removeSentPendingErrorReports(sentIds)
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("flushPendingErrorOccurrences failed", error)
    }
  }
}

export async function flushPendingErrorOccurrences(options?: {
  transport?: ErrorOccurrenceTransport
}): Promise<void> {
  const requestedTransport = options?.transport ?? "default"
  pendingFlushTransport = coalescePendingFlushTransport(requestedTransport, pendingFlushTransport)

  if (flushInFlightPromise) {
    await flushInFlightPromise
    return
  }

  flushInFlightPromise = (async () => {
    try {
      while (pendingFlushTransport) {
        const transport = pendingFlushTransport
        pendingFlushTransport = null
        await flushPendingErrorOccurrencesOnce({ transport })
      }
    } finally {
      flushInFlightPromise = null
    }
  })()

  await flushInFlightPromise
}

export async function reportErrorOccurrence(
  report: ErrorOccurrenceReport,
  options?: {
    requestContext?: ErrorOccurrenceRequestContext
    transport?: ErrorOccurrenceTransport
  },
): Promise<void> {
  try {
    const url = resolveUrlForEnvironment(options?.requestContext)
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
    const transport = options?.transport ?? "default"
    const forwardedHeaders = pickForwardedRequestHeaders(options?.requestContext)

    if (transport === "exit") {
      if (!sendWithBeacon(url, body) && isBrowserEnvironment()) {
        enqueuePendingErrorReport(body)
      }
      return
    }

    if (isBrowserEnvironment() && browserLooksOffline()) {
      enqueuePendingErrorReport(body)
      return
    }

    const sent = await sendWithFetch(url, body, { headers: forwardedHeaders })
    if (!sent && isBrowserEnvironment()) {
      enqueuePendingErrorReport(body)
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("reportErrorOccurrence failed", error)
    }
    // Reporting must never throw.
  }
}
