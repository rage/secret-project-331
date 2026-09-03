import type { TFunction } from "i18next"

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
  | "response_validation_error"
  | "validation_error_with_metadata"
  | "course_slug_already_taken"
  | "not_found"
  | "unauthorized"
  | "chapter_not_open_yet"
  | "authentication_required_for_exam_exercise"
  | "forbidden"
  | "rate_limited"
  | "oauth_error"
  | "invalid_course_code"
  | "generic_sisu_error"
  | "sisu_resource_not_found"
  | "foreign_key_violation"

export interface ErrorViewIssue {
  path?: string | undefined
  code?: string | undefined
  message: string
}

export interface ErrorViewTechnicalDetails {
  detail?: string | null
  stack?: string | null
  method?: string | null
  url?: string | null
  raw?: unknown
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

/** `AppApiError.name` in `common`; shared so the two packages can't drift apart despite the import ban below. */
export const APP_API_ERROR_NAME = "AppApiError"
const ZOD_ERROR_NAME = "ZodError"
const ABORT_ERROR_NAME = "AbortError"
const AGGREGATE_ERROR_NAME = "AggregateError"
const TIMEOUT_MARKER = "timeout"

/**
 * Structural stand-in for `common`'s `AppApiError`, whose fields this reads but whose class this
 * package must not import: `common` already depends on `components`, and each service vendors its
 * own copy of both, so `instanceof` would be unreliable even without the cycle.
 */
interface AppApiErrorLike extends Error {
  kind?: string
  status?: number | null
  requestId?: string | null
  messageKey?: string | null
  type?: string | null
  code?: string | null
  userMessage?: string | null
  detail?: string | null
  issues?: ErrorViewIssue[]
  metadata?: Record<string, unknown> | null
  extra?: Record<string, unknown> | null
  retryAfterSeconds?: number | null
  url?: string | null
  method?: string | null
  body?: unknown
  rawText?: string | null
}

/** The fields of a Zod issue that `summarizeZodIssue` reads, all untrusted. */
interface ZodIssueLike {
  message: string
  code?: unknown
  path?: unknown
  expected?: unknown
  received?: unknown
  format?: unknown
  pattern?: unknown
  maximum?: unknown
  minimum?: unknown
  inclusive?: unknown
  keys?: unknown
}

interface ZodErrorLike extends Error {
  issues: ZodIssueLike[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isAppApiErrorLike(value: unknown): value is AppApiErrorLike {
  return value instanceof Error && value.name === APP_API_ERROR_NAME
}

function isZodErrorLike(value: unknown): value is ZodErrorLike {
  return (
    value instanceof Error &&
    value.name === ZOD_ERROR_NAME &&
    Array.isArray((value as { issues?: unknown }).issues)
  )
}

function isBackendMessageKey(value: unknown): value is BackendMessageKey {
  return (
    value === "internal_error" ||
    value === "validation_error" ||
    value === "response_validation_error" ||
    value === "validation_error_with_metadata" ||
    value === "course_slug_already_taken" ||
    value === "not_found" ||
    value === "unauthorized" ||
    value === "chapter_not_open_yet" ||
    value === "authentication_required_for_exam_exercise" ||
    value === "forbidden" ||
    value === "rate_limited" ||
    value === "oauth_error" ||
    value === "invalid_course_code" ||
    value === "generic_sisu_error" ||
    value === "sisu_resource_not_found" ||
    value === "foreign_key_violation"
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

interface SimplifiedPayload {
  type?: unknown
  message_key?: unknown
  message?: unknown
  errors?: unknown
  metadata?: unknown
}

interface LegacyErrorResponse {
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

/** The plain `{ message, stack? }` object `withErrorBoundary` throws — not a real `Error`, since it crosses a React class-component state boundary. */
interface FrontendCrashPayload {
  message: string
  stack?: string
}

// Narrower than isSimplifiedPayload so a crash's stack isn't dropped by matching the generic
// backend-payload shape first: a real backend payload never carries `stack`.
function isFrontendCrashPayload(value: unknown): value is FrontendCrashPayload {
  return (
    isRecord(value) &&
    !(value instanceof Error) &&
    typeof value.message === "string" &&
    (value.stack === undefined || typeof value.stack === "string") &&
    value.type === undefined &&
    value.message_key === undefined &&
    value.errors === undefined &&
    value.metadata === undefined
  )
}

function normalizeFrontendCrash(payload: FrontendCrashPayload, t: TFunction): ErrorViewModel {
  return {
    category: "client",
    severity: "error",
    title: payload.message || t("error-unexpected-error"),
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
    technicalDetails:
      payload.stack === undefined ? null : { stack: payload.stack, detail: payload.message },
    raw: payload,
  }
}

function joinIssuePath(path: unknown): string | undefined {
  if (typeof path === "string") {
    return path
  }
  if (Array.isArray(path)) {
    return path
      .filter((segment): segment is string | number => {
        return typeof segment === "string" || typeof segment === "number"
      })
      .join(".")
  }
  return undefined
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
        path: joinIssuePath(v.path),
        code: typeof v.code === "string" ? v.code : undefined,
      },
    ]
  })
}

function summarizeZodIssue(issue: ZodIssueLike, t: TFunction): string {
  if (issue.code === "invalid_type" && "expected" in issue && "received" in issue) {
    return t("error-zod-issue.invalid_type", {
      expected: String(issue.expected),
      received: String(issue.received),
    })
  }
  if (issue.code === "invalid_format") {
    if ("format" in issue && issue.format) {
      return t("error-zod-issue.invalid_format", {
        format: String(issue.format),
      })
    }
    if ("pattern" in issue && issue.pattern) {
      return t("error-zod-issue.invalid_format_pattern", {
        pattern: String(issue.pattern),
      })
    }
  }
  if (issue.code === "too_big" && "maximum" in issue && "inclusive" in issue) {
    return t("error-zod-issue.too_big", {
      comparator: issue.inclusive ? "<=" : "<",
      maximum: String(issue.maximum),
    })
  }
  if (issue.code === "too_small" && "minimum" in issue && "inclusive" in issue) {
    return t("error-zod-issue.too_small", {
      comparator: issue.inclusive ? ">=" : ">",
      minimum: String(issue.minimum),
    })
  }
  if (issue.code === "unrecognized_keys" && "keys" in issue && Array.isArray(issue.keys)) {
    return t("error-zod-issue.unrecognized_keys", {
      keys: issue.keys.join(", "),
    })
  }
  return issue.message
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
  return isRecord(value) && value.name === AGGREGATE_ERROR_NAME && Array.isArray(value.errors)
}

function normalizePayload(payload: SimplifiedPayload, t: TFunction): ErrorViewModel {
  const messageKey = isBackendMessageKey(payload.message_key) ? payload.message_key : null
  const type = typeof payload.type === "string" ? payload.type : null
  const message = typeof payload.message === "string" ? payload.message : null
  const metadata = isRecord(payload.metadata) ? payload.metadata : null
  const blockId = metadata && typeof metadata.block_id === "string" ? metadata.block_id : null
  const category: ErrorCategory =
    messageKey === "rate_limited"
      ? "rate_limit"
      : messageKey === "validation_error" ||
          messageKey === "validation_error_with_metadata" ||
          messageKey === "course_slug_already_taken" ||
          messageKey === "response_validation_error"
        ? "validation"
        : messageKey === "unauthorized" ||
            messageKey === "chapter_not_open_yet" ||
            messageKey === "authentication_required_for_exam_exercise" ||
            messageKey === "forbidden"
          ? "auth"
          : messageKey === "not_found"
            ? "not_found"
            : "client"

  return {
    category,
    severity: severityFromCategory(category),
    title: message ?? type ?? t("error-request-failed"),
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

function normalizeAppApiError(error: AppApiErrorLike, t: TFunction): ErrorViewModel {
  const messageKey = isBackendMessageKey(error.messageKey) ? error.messageKey : null
  const status = error.status ?? null
  const category =
    error.kind === "abort"
      ? "abort"
      : error.kind === "network"
        ? "network"
        : error.kind === "parse"
          ? "client"
          : categoryFromStatus(status)
  const blockId =
    error.metadata && typeof error.metadata.block_id === "string" ? error.metadata.block_id : null

  return {
    category,
    severity: severityFromCategory(category),
    title: error.message || t("error-request-failed"),
    message: error.userMessage ?? error.detail ?? null,
    requestId: error.requestId ?? null,
    status,
    messageKey,
    type: error.type ?? null,
    code: error.code ?? null,
    retryable: status === null || status >= 500 || status === 429,
    retryAfterSeconds: error.retryAfterSeconds ?? null,
    issues: error.issues ?? [],
    blockId,
    technicalDetails: {
      detail: error.detail ?? null,
      method: error.method ?? null,
      url: error.url ?? null,
      raw: {
        type: error.type ?? null,
        messageKey: error.messageKey ?? null,
        code: error.code ?? null,
        message: error.userMessage ?? null,
        status,
        issues: error.issues ?? [],
        metadata: error.metadata ?? null,
        extra: error.extra ?? null,
        body: error.body,
        rawText: error.rawText ?? null,
      },
    },
    raw: error,
  }
}

/**
 * Turns any thrown value into the one shape the error UI renders: canonical API failures, the
 * legacy `{ title, message, source }` response, bare backend payloads, OAuth and rate-limit
 * bodies, `AggregateError`, Zod validation failures, aborts, `Error`, and anything else.
 *
 * `t` resolves the `shared-module` namespace; the result still holds raw backend copy, so pair it
 * with `resolveErrorDisplayCopy` for the localized title and message a reader should see.
 */
export function normalizeErrorForDisplay(error: unknown, t: TFunction): ErrorViewModel {
  if (isAppApiErrorLike(error)) {
    return normalizeAppApiError(error, t)
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
  if (isFrontendCrashPayload(error)) {
    return normalizeFrontendCrash(error, t)
  }
  if (isSimplifiedPayload(error)) {
    return normalizePayload(error, t)
  }

  if (isRecord(error) && error.error === "too_many_requests") {
    return normalizePayload(
      {
        type: "rate_limit",
        message_key: "rate_limited",
        message: t("error-too-many-requests"),
        errors: [],
      },
      t,
    )
  }

  if (isRecord(error) && typeof error.error === "string") {
    return normalizePayload(
      {
        type: "oauth_error",
        message_key: "oauth_error",
        message:
          typeof error.error_description === "string" ? error.error_description : error.error,
        errors: [],
      },
      t,
    )
  }

  if (isAggregateLike(error)) {
    const first = error.errors?.[0]
    const firstNormalized = first ? normalizeErrorForDisplay(first, t) : null
    return {
      category: firstNormalized?.category ?? "client",
      severity: firstNormalized?.severity ?? "error",
      title:
        (typeof error.message === "string" ? error.message : null) ||
        t("error-multiple-errors-occurred"),
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

  if (isZodErrorLike(error)) {
    const issues: ErrorViewIssue[] = error.issues.map((issue) => ({
      message: summarizeZodIssue(issue, t),
      path: joinIssuePath(issue.path),
      code: typeof issue.code === "string" ? issue.code : undefined,
    }))
    return {
      category: "validation",
      severity: "error",
      title: t("error-message-key.response_validation_error.title"),
      message: null,
      requestId: null,
      status: 422,
      messageKey: "response_validation_error",
      type: "response_validation_error",
      code: null,
      retryable: false,
      retryAfterSeconds: null,
      issues,
      blockId: null,
      technicalDetails: { raw: error.issues },
      raw: error,
    }
  }

  if (error instanceof Error && error.name === ABORT_ERROR_NAME) {
    return {
      category: "abort",
      severity: "info",
      title: t("error-request-cancelled"),
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
    const isTimeout = error.message.toLowerCase().includes(TIMEOUT_MARKER)
    return {
      category: isTimeout ? "timeout" : "client",
      severity: "error",
      title: error.message || t("error-unexpected-error"),
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
    title: t("error-unexpected-error"),
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
