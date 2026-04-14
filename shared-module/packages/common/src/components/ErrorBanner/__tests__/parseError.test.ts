import { AppApiError } from "../../../errors/AppApiError"
import { parseError } from "../parseError"

describe("parseError", () => {
  const defaultTitle = "Translated Error"

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
    const result = parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Validation failed",
      message: "Please fix fields",
      sourceData: { detail: "detail", method: null, url: null },
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
    const result = parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Internal Server Error",
      message: "Something broke",
      sourceData: { detail: "trace..." },
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
    const result = parseError(err, defaultTitle)
    expect(result.title).toBe("Boom")
    expect(typeof result.sourceData).toBe("object")
    expect((result.sourceData as { detail?: string }).detail).toContain("Boom")
  })

  test("parses string", () => {
    const result = parseError("something went wrong", defaultTitle)
    expect(result.title).toBe("Unexpected error")
    expect(result.message).toBe("something went wrong")
  })

  test("parses unknown object", () => {
    const input = { foo: "bar" }
    const result = parseError(input, defaultTitle)
    expect(result.title).toBe("Unexpected error")
    expect(result.message).toContain("foo")
  })
})
