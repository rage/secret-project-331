import {
  AppApiError,
  appApiErrorFromHttpFailure,
  appApiErrorFromTransportFailure,
  extractRequestIdFromHeaders,
  extractRetryAfterSeconds,
  isAppApiError,
} from "../AppApiError"
import { normalizeErrorForDisplay } from "../normalizeErrorForDisplay"

const t = ((key: string) => key) as never

describe("AppApiError", () => {
  test("extracts request id and retry-after from headers", () => {
    const headers = new Headers({
      "request-id": "req-123",
      "retry-after": "12",
    })
    expect(extractRequestIdFromHeaders(headers)).toBe("req-123")
    expect(extractRetryAfterSeconds(headers)).toBe(12)
  })

  test("creates api error from canonical payload", () => {
    const request = new Request("https://example.com/api", { method: "POST" })
    const response = {
      status: 422,
      statusText: "Unprocessable Entity",
      headers: new Headers({
        "request-id": "req-1",
      }),
    } as unknown as Response
    const err = appApiErrorFromHttpFailure({
      body: {
        type: "validation_error",
        message_key: "validation_error",
        code: "FORM_VALIDATION_FAILED",
        message: "Please fix your input",
        errors: [{ path: "body.email", code: "invalid", message: "Invalid email" }],
        metadata: { block_id: "block-a" },
        trace_id: "trace-123",
      },
      response,
      request,
    })
    expect(isAppApiError(err)).toBe(true)
    expect(err.status).toBe(422)
    expect(err.requestId).toBe("req-1")
    expect(err.messageKey).toBe("validation_error")
    expect(err.type).toBe("validation_error")
    expect(err.code).toBe("FORM_VALIDATION_FAILED")
    expect(err.issues).toHaveLength(1)
    expect(err.extra).toEqual({ trace_id: "trace-123" })
  })

  test("classifies abort failures", () => {
    const abortErr = new DOMException("Aborted", "AbortError")
    const err = appApiErrorFromTransportFailure({ error: abortErr })
    expect(err.kind).toBe("abort")
  })

  test("normalizes app api error for display", () => {
    const err = new AppApiError({
      kind: "api",
      status: 429,
      title: "Too Many Requests",
      userMessage: "Please retry later",
      requestId: "req-2",
      retryAfterSeconds: 30,
      code: "TOO_MANY_REQUESTS",
      messageKey: "rate_limited",
      type: "rate_limit",
      metadata: { block_id: "block-rate" },
      extra: { trace_id: "trace-2" },
      body: { type: "rate_limit", message_key: "rate_limited" },
      rawText: '{"type":"rate_limit"}',
    })
    const normalized = normalizeErrorForDisplay(err, t)
    expect(normalized.category).toBe("rate_limit")
    expect(normalized.requestId).toBe("req-2")
    expect(normalized.retryAfterSeconds).toBe(30)
    expect(normalized.technicalDetails?.raw).toEqual({
      type: "rate_limit",
      messageKey: "rate_limited",
      code: "TOO_MANY_REQUESTS",
      message: "Please retry later",
      status: 429,
      issues: [],
      metadata: { block_id: "block-rate" },
      extra: { trace_id: "trace-2" },
      body: { type: "rate_limit", message_key: "rate_limited" },
      rawText: '{"type":"rate_limit"}',
    })
  })

  test("normalizes chapter_not_open_yet as auth category", () => {
    const err = new AppApiError({
      kind: "api",
      status: 401,
      type: "unauthorized",
      messageKey: "chapter_not_open_yet",
      title: "Chapter is not open yet.",
    })
    const normalized = normalizeErrorForDisplay(err, t)
    expect(normalized.category).toBe("auth")
    expect(normalized.messageKey).toBe("chapter_not_open_yet")
  })

  test("normalizes authentication_required_for_exam_exercise as auth category", () => {
    const err = new AppApiError({
      kind: "api",
      status: 401,
      type: "unauthorized",
      messageKey: "authentication_required_for_exam_exercise",
      title: "User must be authenticated to view exam exercises",
    })
    const normalized = normalizeErrorForDisplay(err, t)
    expect(normalized.category).toBe("auth")
    expect(normalized.messageKey).toBe("authentication_required_for_exam_exercise")
  })

  test("keeps type and code semantics separate in display model", () => {
    const err = new AppApiError({
      kind: "api",
      status: 400,
      type: "validation_error",
      code: "FORM_VALIDATION_FAILED",
      messageKey: "validation_error",
      title: "Validation failed",
    })
    const normalized = normalizeErrorForDisplay(err, t)
    expect(normalized.type).toBe("validation_error")
    expect(normalized.code).toBe("FORM_VALIDATION_FAILED")
    expect(normalized.messageKey).toBe("validation_error")
  })
})
