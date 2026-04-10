import { AppApiError, isAppApiError } from "./AppApiError"

export type ErrorCategory =
  | "validation"
  | "auth"
  | "not_found"
  | "rate_limit"
  | "network"
  | "timeout"
  | "abort"
  | "server"
  | "client"
  | "unknown"

export type ErrorSeverity = "info" | "warning" | "error"

export type BackendMessageKey =
  | "internal_error"
  | "validation_error"
  | "validation_error_with_metadata"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "oauth_error"

export interface ErrorViewIssue {
  path?: string
  code?: string
  message: string
}

export interface ErrorViewTechnicalDetails {
  detail?: string | null
  stack?: string | null
  method?: string | null
  url?: string | null
}

export interface ErrorViewModel {
  category: ErrorCategory
  severity: ErrorSeverity
  title: string
  message: string | null
  requestId: string | null
  status: number | null
  messageKey: BackendMessageKey | null
  type: string | null
  code: string | null
  retryable: boolean
  retryAfterSeconds: number | null
  issues: ErrorViewIssue[]
  blockId: string | null
  technicalDetails: ErrorViewTechnicalDetails | null
  raw: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isBackendMessageKey(value: unknown): value is BackendMessageKey {
  return (
    value === "internal_error" ||
    value === "validation_error" ||
    value === "validation_error_with_metadata" ||
    value === "not_found" ||
    value === "unauthorized" ||
    value === "forbidden" ||
    value === "rate_limited" ||
    value === "oauth_error"
  )
}

function categoryFromStatus(status: number | null): ErrorCategory {
  if (status === null) {
    return "unknown"
  }
  if (status === 401 || status === 403) {
    return "auth"
  }
  if (status === 404) {
    return "not_found"
  }
  if (status === 422) {
    return "validation"
  }
  if (status === 429) {
    return "rate_limit"
  }
  if (status >= 500) {
    return "server"
  }
  if (status >= 400) {
    return "client"
  }
  return "unknown"
}

function severityFromCategory(category: ErrorCategory): ErrorSeverity {
  return category === "rate_limit" || category === "unknown" ? "warning" : "error"
}

type SimplifiedPayload = {
  type?: unknown
  message_key?: unknown
  message?: unknown
  errors?: unknown
  metadata?: unknown
}

type LegacyErrorResponse = {
  title?: unknown
  message?: unknown
  source?: unknown
  data?: unknown
  status?: unknown
}

function isSimplifiedPayload(value: unknown): value is SimplifiedPayload {
  if (!isRecord(value) || value instanceof Error) {
    return false
  }
  return (
    typeof value.type === "string" ||
    typeof value.message_key === "string" ||
    typeof value.message === "string" ||
    Array.isArray(value.errors) ||
    isRecord(value.metadata)
  )
}

function parseIssues(value: unknown): ErrorViewIssue[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((v) => {
    if (!isRecord(v) || typeof v.message !== "string") {
      return []
    }
    return [
      {
        message: v.message,
        path: typeof v.path === "string" ? v.path : undefined,
        code: typeof v.code === "string" ? v.code : undefined,
      },
    ]
  })
}

function isLegacyBackendError(value: unknown): value is LegacyErrorResponse {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.message === "string" &&
    (value.source === undefined || typeof value.source === "string")
  )
}

function isAggregateLike(value: unknown): value is { message?: unknown; errors?: unknown[] } {
  return isRecord(value) && value.name === "AggregateError" && Array.isArray(value.errors)
}

function normalizePayload(payload: SimplifiedPayload): ErrorViewModel {
  const messageKey = isBackendMessageKey(payload.message_key) ? payload.message_key : null
  const type = typeof payload.type === "string" ? payload.type : null
  const message = typeof payload.message === "string" ? payload.message : null
  const metadata = isRecord(payload.metadata) ? payload.metadata : null
  const blockId = metadata && typeof metadata.block_id === "string" ? metadata.block_id : null
  const category: ErrorCategory =
    messageKey === "rate_limited"
      ? "rate_limit"
      : messageKey === "validation_error" || messageKey === "validation_error_with_metadata"
        ? "validation"
        : messageKey === "unauthorized" || messageKey === "forbidden"
          ? "auth"
          : messageKey === "not_found"
            ? "not_found"
            : "client"

  return {
    category,
    severity: severityFromCategory(category),
    title: message ?? type ?? "Request failed",
    message,
    requestId: null,
    status: null,
    messageKey,
    type,
    code: null,
    retryable: category === "rate_limit",
    retryAfterSeconds: null,
    issues: parseIssues(payload.errors),
    blockId,
    technicalDetails: null,
    raw: payload,
  }
}

function normalizeAppApiError(error: AppApiError): ErrorViewModel {
  const messageKey = isBackendMessageKey(error.messageKey) ? error.messageKey : null
  const category =
    error.kind === "abort"
      ? "abort"
      : error.kind === "network"
        ? "network"
        : error.kind === "parse"
          ? "client"
          : categoryFromStatus(error.status)
  const blockId =
    error.metadata && typeof error.metadata.block_id === "string" ? error.metadata.block_id : null

  return {
    category,
    severity: severityFromCategory(category),
    title: error.message || "Request failed",
    message: error.userMessage ?? error.detail ?? null,
    requestId: error.requestId,
    status: error.status,
    messageKey,
    type: error.type,
    code: error.code,
    retryable: error.status === null || error.status >= 500 || error.status === 429,
    retryAfterSeconds: error.retryAfterSeconds,
    issues: error.issues,
    blockId,
    technicalDetails: {
      detail: error.detail,
      method: error.method,
      url: error.url,
    },
    raw: error,
  }
}

export function normalizeErrorForDisplay(error: unknown): ErrorViewModel {
  if (isAppApiError(error)) {
    return normalizeAppApiError(error)
  }
  if (isLegacyBackendError(error)) {
    const data = isRecord(error.data) ? error.data : null
    const status = typeof error.status === "number" ? error.status : null
    const category = categoryFromStatus(status)
    return {
      category,
      severity: severityFromCategory(category),
      title: String(error.title),
      message: String(error.message),
      requestId: null,
      status,
      messageKey: null,
      type: null,
      code: null,
      retryable: status === null || status >= 500 || status === 429,
      retryAfterSeconds: null,
      issues: [],
      blockId: data && typeof data.block_id === "string" ? data.block_id : null,
      technicalDetails: { detail: typeof error.source === "string" ? error.source : null },
      raw: error,
    }
  }
  if (isSimplifiedPayload(error)) {
    return normalizePayload(error)
  }

  if (isRecord(error) && error.error === "too_many_requests") {
    return normalizePayload({
      type: "rate_limit",
      message_key: "rate_limited",
      message: "Too many requests. Please try again later.",
      errors: [],
    })
  }

  if (isRecord(error) && typeof error.error === "string") {
    return normalizePayload({
      type: "oauth_error",
      message_key: "oauth_error",
      message: typeof error.error_description === "string" ? error.error_description : error.error,
      errors: [],
    })
  }

  if (isAggregateLike(error)) {
    const first = error.errors?.[0]
    const firstNormalized = first ? normalizeErrorForDisplay(first) : null
    return {
      category: firstNormalized?.category ?? "client",
      severity: firstNormalized?.severity ?? "error",
      title:
        (typeof error.message === "string" ? error.message : null) || "Multiple errors occurred",
      message: firstNormalized?.message ?? null,
      requestId: firstNormalized?.requestId ?? null,
      status: firstNormalized?.status ?? null,
      messageKey: firstNormalized?.messageKey ?? null,
      type: firstNormalized?.type ?? null,
      code: firstNormalized?.code ?? null,
      retryable: true,
      retryAfterSeconds: firstNormalized?.retryAfterSeconds ?? null,
      issues: firstNormalized?.issues ?? [],
      blockId: firstNormalized?.blockId ?? null,
      technicalDetails: { detail: `AggregateError(${String(error.errors?.length ?? 0)})` },
      raw: error,
    }
  }

  if (isRecord(error) && error.name === "ZodError" && Array.isArray(error.issues)) {
    return {
      category: "validation",
      severity: "error",
      title: "Invalid input",
      message: null,
      requestId: null,
      status: 422,
      messageKey: "validation_error",
      type: "validation_error",
      code: null,
      retryable: false,
      retryAfterSeconds: null,
      issues: parseIssues(error.issues),
      blockId: null,
      technicalDetails: null,
      raw: error,
    }
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      category: "abort",
      severity: "info",
      title: "Request was cancelled",
      message: error.message || null,
      requestId: null,
      status: null,
      messageKey: null,
      type: null,
      code: null,
      retryable: true,
      retryAfterSeconds: null,
      issues: [],
      blockId: null,
      technicalDetails: null,
      raw: error,
    }
  }

  if (error instanceof Error) {
    const isTimeout = error.message.toLowerCase().includes("timeout")
    return {
      category: isTimeout ? "timeout" : "client",
      severity: "error",
      title: error.message || "Unexpected error",
      message: null,
      requestId: null,
      status: null,
      messageKey: null,
      type: null,
      code: null,
      retryable: true,
      retryAfterSeconds: null,
      issues: [],
      blockId: null,
      technicalDetails: { stack: error.stack ?? null, detail: error.message },
      raw: error,
    }
  }

  return {
    category: "unknown",
    severity: "warning",
    title: "Unexpected error",
    message:
      typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error)
            } catch {
              return String(error)
            }
          })(),
    requestId: null,
    status: null,
    messageKey: null,
    type: null,
    code: null,
    retryable: true,
    retryAfterSeconds: null,
    issues: [],
    blockId: null,
    technicalDetails: null,
    raw: error,
  }
}
