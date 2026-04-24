import {
  getAuthLoggedInQueryKey,
  getAuthUserInfoQueryKey,
} from "../generated/auth-api/@tanstack/react-query.generated"
import { getAuthLoggedIn, getAuthUserInfo } from "../generated/auth-api/sdk.generated"
import type {
  GetAuthLoggedInResponse,
  GetAuthUserInfoResponse,
} from "../generated/auth-api/types.generated"
import { queryClient } from "../services/appQueryClient"

export type ErrorSource = "backend" | "frontend"
export type ErrorOccurrenceTransport = "default" | "exit"
type ErrorOccurrenceRequestHeaders =
  | Headers
  | ReadonlyArray<readonly [string, string]>
  | Readonly<Record<string, string>>

export type ErrorOccurrenceReport = {
  service?: string
  error_source?: ErrorSource
  message: string
  stack_trace?: string | null
  path?: string | null
  app_version?: string | null
  details?: unknown
}

export type ErrorOccurrenceRequestContext = {
  headers?: ErrorOccurrenceRequestHeaders | null
  url?: string | URL | null
}

const ERRORS_ENDPOINT_PATH = "/api/v0/errors"
const DEFAULT_INTERNAL_ERRORS_BASE_URL = "http://headless-lms:3001"
const PENDING_ERROR_REPORTS_STORAGE_KEY = "pending_error_occurrence_reports"
const MAX_PENDING_ERROR_REPORTS = 20

type PendingErrorReportAuthScope = "anonymous" | "unknown" | `user:${string}`

type PendingErrorReportRecord = {
  id: string
  body: string
  authScope: PendingErrorReportAuthScope
}

let defaultServiceSlug: string | null = null
let pendingFlushTransport: ErrorOccurrenceTransport | null = null
let flushInFlightPromise: Promise<void> | null = null
let authScopeProbePromise: Promise<PendingErrorReportAuthScope> | null = null

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
    process.env.NEXT_PUBLIC_ERRORS_BASE_URL?.trim() ||
    resolveErrorReportUrlFromRequestContext(requestContext) ||
    process.env.ERRORS_MAIN_FRONTEND_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_ERRORS_MAIN_FRONTEND_BASE_URL?.trim() ||
    process.env.BASE_URL?.trim() ||
    process.env.PUBLIC_ADDRESS?.trim() ||
    DEFAULT_INTERNAL_ERRORS_BASE_URL
  return new URL(ERRORS_ENDPOINT_PATH, baseUrl).toString()
}

function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined"
}

function isPendingErrorReportAuthScope(value: unknown): value is PendingErrorReportAuthScope {
  return (
    value === "anonymous" ||
    value === "unknown" ||
    (typeof value === "string" && value.startsWith("user:") && value.length > "user:".length)
  )
}

function toPendingErrorReportRecord(
  value: unknown,
  index: number,
): PendingErrorReportRecord | null {
  if (typeof value === "string") {
    return {
      id: `legacy-${index}`,
      body: value,
      authScope: "unknown",
    }
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
    authScope: isPendingErrorReportAuthScope(record.authScope) ? record.authScope : "unknown",
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

function resolveCurrentPendingErrorReportAuthScopeFromCache(): PendingErrorReportAuthScope {
  const isLoggedIn = queryClient.getQueryData<GetAuthLoggedInResponse>(getAuthLoggedInQueryKey())
  if (isLoggedIn === false) {
    return "anonymous"
  }

  const userInfo = queryClient.getQueryData<GetAuthUserInfoResponse>(getAuthUserInfoQueryKey())
  if (userInfo && typeof userInfo.user_id === "string" && userInfo.user_id.trim() !== "") {
    return `user:${userInfo.user_id}`
  }

  return "unknown"
}

async function probeCurrentPendingErrorReportAuthScope(): Promise<PendingErrorReportAuthScope> {
  if (authScopeProbePromise) {
    return authScopeProbePromise
  }

  authScopeProbePromise = (async () => {
    try {
      const isLoggedIn = await getAuthLoggedIn({ throwOnError: false })
      if (isLoggedIn === false) {
        queryClient.setQueryData(getAuthLoggedInQueryKey(), false)
        queryClient.removeQueries({ queryKey: getAuthUserInfoQueryKey(), exact: true })
        return "anonymous"
      }

      if (isLoggedIn === true) {
        queryClient.setQueryData(getAuthLoggedInQueryKey(), true)
      }

      const userInfo = await getAuthUserInfo({ throwOnError: false })
      if (userInfo && typeof userInfo.user_id === "string" && userInfo.user_id.trim() !== "") {
        queryClient.setQueryData(getAuthUserInfoQueryKey(), userInfo)
        return `user:${userInfo.user_id}`
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("reportErrorOccurrence failed to probe auth scope", error)
      }
    } finally {
      authScopeProbePromise = null
    }

    return "unknown"
  })()

  return authScopeProbePromise
}

function enqueuePendingErrorReport(body: string): void {
  const queued = readPendingErrorReports()
  queued.push({
    id: createPendingErrorReportId(),
    body,
    authScope: resolveCurrentPendingErrorReportAuthScopeFromCache(),
  })
  writePendingErrorReports(queued.slice(-MAX_PENDING_ERROR_REPORTS))
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
    const blob = new Blob([body], { type: "text/plain;charset=UTF-8" })
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

function classifyPendingErrorReportForFlush(
  report: PendingErrorReportRecord,
  authScope: PendingErrorReportAuthScope,
): "discard" | "retain" | "send" {
  if (report.authScope === "unknown") {
    return "send"
  }

  if (report.authScope === "anonymous") {
    return authScope === "unknown" ? "retain" : "send"
  }

  if (authScope === "unknown") {
    return "retain"
  }

  return report.authScope === authScope ? "send" : "discard"
}

function selectPendingErrorReportsForFlush(authScope: PendingErrorReportAuthScope): {
  discardedIds: Set<string>
  pending: PendingErrorReportRecord[]
} {
  const discardedIds = new Set<string>()
  const pending: PendingErrorReportRecord[] = []

  for (const report of readPendingErrorReports()) {
    const disposition = classifyPendingErrorReportForFlush(report, authScope)

    if (disposition === "discard") {
      discardedIds.add(report.id)
      continue
    }

    if (disposition === "send") {
      pending.push(report)
    }
  }

  return { discardedIds, pending }
}

async function sendPendingErrorReport(
  url: string,
  report: PendingErrorReportRecord,
  transport: ErrorOccurrenceTransport,
  authScope: PendingErrorReportAuthScope,
): Promise<boolean> {
  if (
    transport === "exit" &&
    (report.authScope !== "anonymous" || authScope === "anonymous") &&
    sendWithBeacon(url, report.body)
  ) {
    return true
  }

  return await sendWithFetch(url, report.body, {
    credentials: report.authScope === "anonymous" ? "omit" : "include",
  })
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
    let authScope = resolveCurrentPendingErrorReportAuthScopeFromCache()
    if (authScope === "unknown" && transport !== "exit") {
      authScope = await probeCurrentPendingErrorReportAuthScope()
    }
    const { discardedIds, pending } = selectPendingErrorReportsForFlush(authScope)
    if (pending.length === 0) {
      removeSentPendingErrorReports(discardedIds)
      return
    }

    if (transport === "default" && browserLooksOffline()) {
      removeSentPendingErrorReports(discardedIds)
      return
    }

    const sentIds = new Set<string>(discardedIds)

    for (const pendingReport of pending) {
      const sent = await sendPendingErrorReport(url, pendingReport, transport, authScope)

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
