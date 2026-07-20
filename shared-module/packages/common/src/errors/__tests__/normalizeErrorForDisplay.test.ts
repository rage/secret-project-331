import { AppApiError } from "../AppApiError"
import { normalizeErrorForDisplay } from "../normalizeErrorForDisplay"

const t = ((key: string) => key) as never

describe("normalizeErrorForDisplay", () => {
  it("keeps forbidden details and backend payload in technical details", () => {
    const error = new AppApiError({
      kind: "api",
      status: 403,
      type: "forbidden",
      messageKey: "forbidden",
      userMessage: "No permission to view user details",
      metadata: { scope: "course" },
      body: { type: "forbidden", message_key: "forbidden" },
    })

    const normalized = normalizeErrorForDisplay(error, t)
    expect(normalized.category).toBe("auth")
    expect(normalized.messageKey).toBe("forbidden")
    expect(normalized.technicalDetails?.raw).toEqual({
      type: "forbidden",
      messageKey: "forbidden",
      code: null,
      message: "No permission to view user details",
      status: 403,
      issues: [],
      metadata: { scope: "course" },
      extra: null,
      body: { type: "forbidden", message_key: "forbidden" },
      rawText: null,
    })
  })

  it("classifies not_found from message key", () => {
    const error = new AppApiError({
      kind: "api",
      status: 404,
      type: "not_found",
      messageKey: "not_found",
      userMessage: "User not found",
    })

    const normalized = normalizeErrorForDisplay(error, t)
    expect(normalized.category).toBe("not_found")
    expect(normalized.messageKey).toBe("not_found")
  })

  it("handles internal errors without backend message", () => {
    const error = new AppApiError({
      kind: "api",
      status: 500,
      type: "internal_error",
      messageKey: "internal_error",
      title: "Request failed",
    })

    const normalized = normalizeErrorForDisplay(error, t)
    expect(normalized.category).toBe("server")
    expect(normalized.message).toBeNull()
    expect(normalized.messageKey).toBe("internal_error")
  })

  it("keeps validation issues and metadata", () => {
    const error = new AppApiError({
      kind: "api",
      status: 422,
      type: "validation_error",
      messageKey: "validation_error_with_metadata",
      userMessage: "Validation failed",
      issues: [{ path: "email", code: "invalid_email", message: "Email is invalid" }],
      metadata: { block_id: "block-123" },
    })

    const normalized = normalizeErrorForDisplay(error, t)
    expect(normalized.category).toBe("validation")
    expect(normalized.issues).toEqual([
      { path: "email", code: "invalid_email", message: "Email is invalid" },
    ])
    expect(normalized.blockId).toBe("block-123")
  })
})
