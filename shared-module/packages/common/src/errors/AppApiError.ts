export type AppApiErrorKind = "api" | "network" | "abort" | "parse" | "client" | "stream"

export interface CanonicalApiIssue {
  path?: string
  code?: string
  message: string
}

export interface CanonicalApiErrorPayload {
  type?: unknown
  message_key?: unknown
  code?: unknown
  message?: unknown
  errors?: unknown
  metadata?: unknown
}

export interface AppApiErrorInit {
  kind: AppApiErrorKind
  status?: number | null
  requestId?: string | null
  messageKey?: string | null
  type?: string | null
  /** Optional backend machine code. Currently forward-compatible and often absent. */
  code?: string | null
  title?: string
  userMessage?: string | null
  detail?: string | null
  issues?: CanonicalApiIssue[]
  metadata?: Record<string, unknown> | null
  extra?: Record<string, unknown> | null
  retryAfterSeconds?: number | null
  url?: string | null
  method?: string | null
  body?: unknown
  rawText?: string | null
  cause?: unknown
}

/** Returns true when a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Returns a string value if present. */
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

/** Parses canonical issue arrays from unknown input. */
function parseIssues(value: unknown): CanonicalApiIssue[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }
    const message = asString(entry.message)
    if (!message) {
      return []
    }
    return [
      {
        message,
        path: asString(entry.path) ?? undefined,
        code: asString(entry.code) ?? undefined,
      },
    ]
  })
}

export class AppApiError extends Error {
  kind: AppApiErrorKind
  status: number | null
  requestId: string | null
  messageKey: string | null
  type: string | null
  /** Optional backend machine code. Keep separate from semantic `type` and `messageKey`. */
  code: string | null
  userMessage: string | null
  detail: string | null
  issues: CanonicalApiIssue[]
  metadata: Record<string, unknown> | null
  extra: Record<string, unknown> | null
  retryAfterSeconds: number | null
  url: string | null
  method: string | null
  body: unknown
  rawText: string | null
  cause?: unknown

  constructor(init: AppApiErrorInit) {
    const title = init.title?.trim() ? init.title : "Request failed"
    super(title)
    this.name = "AppApiError"
    this.kind = init.kind
    this.status = init.status ?? null
    this.requestId = init.requestId ?? null
    this.messageKey = init.messageKey ?? null
    this.type = init.type ?? null
    this.code = init.code ?? null
    this.userMessage = init.userMessage ?? null
    this.detail = init.detail ?? null
    this.issues = init.issues ?? []
    this.metadata = init.metadata ?? null
    this.extra = init.extra ?? null
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
    this.url = init.url ?? null
    this.method = init.method ?? null
    this.body = init.body
    this.rawText = init.rawText ?? null
    this.cause = init.cause
  }
}

/** Returns true when the input is an AppApiError instance. */
export function isAppApiError(error: unknown): error is AppApiError {
  return error instanceof AppApiError
}

/** Reads request id from headers, supporting common header casing variants. */
export function extractRequestIdFromHeaders(headers: Headers | null | undefined): string | null {
  if (!headers) {
    return null
  }
  return headers.get("request-id") ?? headers.get("x-request-id")
}

/** Reads retry-after as seconds from headers, supporting delta-seconds values. */
export function extractRetryAfterSeconds(headers: Headers | null | undefined): number | null {
  if (!headers) {
    return null
  }
  const raw = headers.get("retry-after")
  if (!raw) {
    return null
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/** Parses canonical backend error payload from unknown JSON. */
export function parseCanonicalApiPayload(payload: unknown): {
  type: string | null
  messageKey: string | null
  code: string | null
  message: string | null
  issues: CanonicalApiIssue[]
  metadata: Record<string, unknown> | null
  extra: Record<string, unknown> | null
} {
  if (!isRecord(payload)) {
    return {
      type: null,
      messageKey: null,
      code: null,
      message: null,
      issues: [],
      metadata: null,
      extra: null,
    }
  }

  const {
    type: _type,
    message_key: _messageKey,
    code: _code,
    message: _message,
    errors: _errors,
    metadata: _metadata,
    ...extra
  } = payload

  return {
    type: asString(payload.type),
    messageKey: asString(payload.message_key),
    code: asString(payload.code),
    message: asString(payload.message),
    issues: parseIssues(payload.errors),
    metadata: isRecord(payload.metadata) ? payload.metadata : null,
    extra: Object.keys(extra).length > 0 ? extra : null,
  }
}

/** Builds an AppApiError from an HTTP failure context. */
export function appApiErrorFromHttpFailure(input: {
  body: unknown
  response: Response
  request: Request
  rawText?: string | null
}): AppApiError {
  const parsed = parseCanonicalApiPayload(input.body)
  const title =
    (parsed.message ??
      parsed.type ??
      (typeof input.body === "string" && input.body.trim() !== "" ? "Request failed" : null) ??
      input.response.statusText) ||
    "Request failed"

  return new AppApiError({
    kind: "api",
    status: input.response.status,
    requestId: extractRequestIdFromHeaders(input.response.headers),
    messageKey: parsed.messageKey,
    type: parsed.type,
    code: parsed.code,
    title,
    userMessage: parsed.message,
    detail: typeof input.body === "string" && input.body.trim() !== "" ? input.body : null,
    issues: parsed.issues,
    metadata: parsed.metadata,
    extra: parsed.extra,
    retryAfterSeconds: extractRetryAfterSeconds(input.response.headers),
    url: input.request.url,
    method: input.request.method,
    body: input.body,
    rawText: input.rawText ?? null,
  })
}

/** Builds an AppApiError from a thrown transport-level failure. */
export function appApiErrorFromTransportFailure(input: {
  error: unknown
  request?: Request | null
}): AppApiError {
  const cause = input.error
  const err = input.error instanceof Error ? input.error : null
  const name = err?.name ?? ""
  const kind: AppApiErrorKind = name === "AbortError" ? "abort" : "network"
  return new AppApiError({
    kind,
    title: kind === "abort" ? "Request was cancelled" : "Network request failed",
    detail: err?.message ?? (typeof input.error === "string" ? input.error : null),
    url: input.request?.url ?? null,
    method: input.request?.method ?? null,
    body: input.error,
    cause,
  })
}
