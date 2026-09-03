import i18next from "i18next"

import { normalizeErrorForDisplay } from "../src/lib/errors/normalizeErrorForDisplay"
import "../tests/test-i18n"

// oxlint-disable-next-line import/no-named-as-default-member -- getFixedT is the instance method
const t = i18next.getFixedT(null, "shared-module")

/**
 * Stand-in for `common`'s `AppApiError`, which this package cannot import. `normalizeErrorForDisplay`
 * recognizes it by `name`, so this fake is the contract: change one side and this test fails.
 */
class FakeAppApiError extends Error {
  public kind = "api"
  public status: number | null = null
  public requestId: string | null = null
  public messageKey: string | null = null
  public type: string | null = null
  public code: string | null = null
  public userMessage: string | null = null
  public detail: string | null = null
  public issues: { path?: string; code?: string; message: string }[] = []
  public metadata: Record<string, unknown> | null = null
  public extra: Record<string, unknown> | null = null
  public retryAfterSeconds: number | null = null
  public url: string | null = null
  public method: string | null = null
  public body: unknown = undefined
  public rawText: string | null = null

  public constructor(title: string, fields: Partial<FakeAppApiError> = {}) {
    super(title)
    this.name = "AppApiError"
    Object.assign(this, fields)
  }
}

/** Stand-in for a Zod v4 `ZodError`, recognized by `name` plus an `issues` array. */
class FakeZodError extends Error {
  public issues: Record<string, unknown>[]

  public constructor(issues: Record<string, unknown>[]) {
    super("Validation failed")
    this.name = "ZodError"
    this.issues = issues
  }
}

describe("normalizeErrorForDisplay", () => {
  test("reads a canonical api error without importing its class", () => {
    const result = normalizeErrorForDisplay(
      new FakeAppApiError("Validation failed", {
        status: 422,
        userMessage: "Please fix fields",
        issues: [{ path: "body.email", message: "Invalid email", code: "invalid_format" }],
        metadata: { block_id: "block-123" },
        requestId: "req-1",
        code: "VALIDATION_FAILED",
        detail: "detail",
      }),
      t,
    )

    expect(result.title).toBe("Validation failed")
    expect(result.message).toBe("Please fix fields")
    expect(result.status).toBe(422)
    expect(result.category).toBe("validation")
    expect(result.severity).toBe("error")
    expect(result.requestId).toBe("req-1")
    expect(result.code).toBe("VALIDATION_FAILED")
    expect(result.blockId).toBe("block-123")
    expect(result.issues).toEqual([
      { path: "body.email", message: "Invalid email", code: "invalid_format" },
    ])
    expect(result.technicalDetails?.detail).toBe("detail")
    expect(result.technicalDetails?.raw).toMatchObject({ status: 422, code: "VALIDATION_FAILED" })
  })

  test("classifies api error kinds that carry no status", () => {
    expect(
      normalizeErrorForDisplay(new FakeAppApiError("x", { kind: "network" }), t).category,
    ).toBe("network")
    expect(normalizeErrorForDisplay(new FakeAppApiError("x", { kind: "abort" }), t).category).toBe(
      "abort",
    )
    expect(normalizeErrorForDisplay(new FakeAppApiError("x", { kind: "parse" }), t).category).toBe(
      "client",
    )
  })

  test("marks a rate limited api error retryable and only a warning", () => {
    const result = normalizeErrorForDisplay(
      new FakeAppApiError("Slow down", { status: 429, retryAfterSeconds: 30 }),
      t,
    )

    expect(result.category).toBe("rate_limit")
    expect(result.severity).toBe("warning")
    expect(result.retryable).toBe(true)
    expect(result.retryAfterSeconds).toBe(30)
  })

  test("parses a simplified backend payload", () => {
    const result = normalizeErrorForDisplay(
      {
        type: "validation_error",
        message_key: "validation_error",
        message: "Input invalid",
        errors: [{ path: ["body", "email"], message: "Invalid email", code: "invalid_format" }],
        metadata: { block_id: "block-42" },
      },
      t,
    )

    expect(result.messageKey).toBe("validation_error")
    expect(result.type).toBe("validation_error")
    expect(result.category).toBe("validation")
    expect(result.code).toBeNull()
    expect(result.blockId).toBe("block-42")
    expect(result.issues).toEqual([
      { path: "body.email", message: "Invalid email", code: "invalid_format" },
    ])
  })

  test("parses the legacy backend response", () => {
    const result = normalizeErrorForDisplay(
      {
        title: "Internal Server Error",
        message: "Something broke",
        source: "trace...",
        data: { block_id: "block-123" },
        status: 500,
      },
      t,
    )

    expect(result.title).toBe("Internal Server Error")
    expect(result.message).toBe("Something broke")
    expect(result.status).toBe(500)
    expect(result.category).toBe("server")
    expect(result.blockId).toBe("block-123")
    expect(result.technicalDetails).toEqual({ detail: "trace..." })
  })

  test("keeps the stack of a plain Error", () => {
    const result = normalizeErrorForDisplay(new Error("Boom"), t)

    expect(result.title).toBe("Boom")
    expect(result.category).toBe("client")
    expect(result.technicalDetails?.stack).toContain("Boom")
  })

  test("keeps the stack of withErrorBoundary's plain-object crash payload", () => {
    const result = normalizeErrorForDisplay({ message: "Boom", stack: "at Boom (App.tsx:1)" }, t)

    expect(result.title).toBe("Boom")
    expect(result.category).toBe("client")
    expect(result.technicalDetails?.stack).toBe("at Boom (App.tsx:1)")
  })

  test("separates a timeout from other Errors", () => {
    expect(normalizeErrorForDisplay(new Error("Request Timeout"), t).category).toBe("timeout")
  })

  test("treats an abort as informational rather than a failure", () => {
    const aborted = new Error("The user aborted a request.")
    aborted.name = "AbortError"
    const result = normalizeErrorForDisplay(aborted, t)

    expect(result.category).toBe("abort")
    expect(result.severity).toBe("info")
    expect(result.title).toBe("Request was cancelled")
  })

  test("summarizes zod issues recognized by shape", () => {
    const result = normalizeErrorForDisplay(
      new FakeZodError([
        { code: "invalid_format", format: "uuid", path: ["user_id"], message: "Invalid UUID" },
        { code: "invalid_type", expected: "number", received: "string", path: [], message: "nope" },
      ]),
      t,
    )

    expect(result.messageKey).toBe("response_validation_error")
    expect(result.type).toBe("response_validation_error")
    expect(result.status).toBe(422)
    expect(result.issues[0]).toEqual({
      path: "user_id",
      code: "invalid_format",
      message: "Expected uuid",
    })
    expect(result.issues[1]?.message).toBe("Expected number, received string")
  })

  test("surfaces the first error of an aggregate", () => {
    const result = normalizeErrorForDisplay(
      new AggregateError(
        [{ title: "Not found", message: "Missing", status: 404 }],
        "All promises rejected",
      ),
      t,
    )

    expect(result.title).toBe("All promises rejected")
    expect(result.message).toBe("Missing")
    expect(result.category).toBe("not_found")
    expect(result.technicalDetails?.detail).toBe("AggregateError(1)")
  })

  test("recognizes the rate limit and oauth bodies", () => {
    const rateLimited = normalizeErrorForDisplay({ error: "too_many_requests" }, t)
    expect(rateLimited.messageKey).toBe("rate_limited")
    expect(rateLimited.category).toBe("rate_limit")

    const oauth = normalizeErrorForDisplay(
      { error: "invalid_grant", error_description: "Token expired" },
      t,
    )
    expect(oauth.messageKey).toBe("oauth_error")
    expect(oauth.message).toBe("Token expired")
  })

  test("falls back for a string and for an unrecognized object", () => {
    const fromString = normalizeErrorForDisplay("something went wrong", t)
    expect(fromString.title).toBe("Unexpected error")
    expect(fromString.message).toBe("something went wrong")
    expect(fromString.severity).toBe("warning")

    const fromObject = normalizeErrorForDisplay({ foo: "bar" }, t)
    expect(fromObject.title).toBe("Unexpected error")
    expect(fromObject.message).toContain("foo")
    expect(fromObject.category).toBe("unknown")
  })
})
