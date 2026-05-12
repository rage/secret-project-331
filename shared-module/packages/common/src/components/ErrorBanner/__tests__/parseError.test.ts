import { z, ZodError } from "zod"

import { AppApiError } from "../../../errors/AppApiError"
import { parseError } from "../parseError"

describe("parseError", () => {
  const defaultTitle = "Translated Error"
  const t = ((key: string, options?: Record<string, unknown>) => {
    if (key === "error-zod-issue.invalid_format") {
      return `Expected ${String(options?.format)}`
    }
    if (key === "error-unexpected-error") {
      return "Unexpected error"
    }
    return key
  }) as never

  test("parses app api errors", () => {
    const input = new AppApiError({
      kind: "api",
      status: 422,
      title: "Validation failed",
      userMessage: "Please fix fields",
      issues: [{ path: "body.email", message: "Invalid email", code: "invalid_format" }],
      metadata: { block_id: "block-123" },
      requestId: "req-1",
      code: "VALIDATION_FAILED",
      retryAfterSeconds: null,
      detail: "detail",
    })
    const result = parseError(input, defaultTitle, t)
    expect(result).toEqual({
      title: "Validation failed",
      message: "Please fix fields",
      sourceData: "detail",
      technicalDetails: {
        detail: "detail",
        method: null,
        url: null,
        raw: {
          type: null,
          messageKey: null,
          code: "VALIDATION_FAILED",
          message: "Please fix fields",
          status: 422,
          issues: [{ path: "body.email", message: "Invalid email", code: "invalid_format" }],
          metadata: { block_id: "block-123" },
          extra: null,
          body: undefined,
          rawText: null,
        },
      },
      linkBlockId: "block-123",
      status: 422,
      messageKey: null,
      type: null,
      requestId: "req-1",
      code: "VALIDATION_FAILED",
      issues: [{ path: "body.email", message: "Invalid email", code: "invalid_format" }],
      retryAfterSeconds: null,
    })
  })

  test("parses simplified backend payload with message_key", () => {
    const result = parseError(
      {
        type: "validation_error",
        message_key: "validation_error",
        message: "Input invalid",
        errors: [{ path: "body.email", message: "Invalid email", code: "invalid_format" }],
        metadata: { block_id: "block-42" },
      },
      defaultTitle,
      t,
    )
    expect(result.messageKey).toBe("validation_error")
    expect(result.type).toBe("validation_error")
    expect(result.code).toBeNull()
    expect(result.linkBlockId).toBe("block-42")
    expect(result.issues).toHaveLength(1)
  })

  test("parses legacy backend error", () => {
    const input = {
      title: "Internal Server Error",
      message: "Something broke",
      source: "trace...",
      data: { block_id: "block-123" },
      status: 500,
    }
    const result = parseError(input, defaultTitle, t)
    expect(result).toEqual({
      title: "Internal Server Error",
      message: "Something broke",
      sourceData: "trace...",
      technicalDetails: { detail: "trace..." },
      linkBlockId: "block-123",
      status: 500,
      messageKey: null,
      type: null,
      requestId: null,
      code: null,
      issues: [],
      retryAfterSeconds: null,
    })
  })

  test("parses plain Error", () => {
    const err = new Error("Boom")
    const result = parseError(err, defaultTitle, t)
    expect(result.title).toBe("Boom")
    expect(result.sourceData).toContain("Boom")
  })

  test("parses zod errors with response validation metadata", () => {
    const schema = z.object({
      user_id: z.string().uuid(),
    })
    let zodError: ZodError | null = null
    try {
      schema.parse({ user_id: "not-a-uuid" })
    } catch (error) {
      if (error instanceof ZodError) {
        zodError = error
      }
    }
    expect(zodError).not.toBeNull()
    const result = parseError(zodError, defaultTitle, t)
    expect(result.messageKey).toBe("response_validation_error")
    expect(result.type).toBe("response_validation_error")
    expect(result.issues?.[0].path).toBe("user_id")
    expect(result.issues?.[0].message).toBe("Expected uuid")
    expect(result.technicalDetails?.raw).toEqual(zodError?.issues)
  })

  test("parses string", () => {
    const result = parseError("something went wrong", defaultTitle, t)
    expect(result.title).toBe("Unexpected error")
    expect(result.message).toBe("something went wrong")
  })

  test("parses unknown object", () => {
    const input = { foo: "bar" }
    const result = parseError(input, defaultTitle, t)
    expect(result.title).toBe("Unexpected error")
    expect(result.message).toContain("foo")
  })
})
