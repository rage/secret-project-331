import { z, ZodError } from "zod"

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

  // The implementation lives in `components`, which cannot depend on zod and so narrows a ZodError
  // by shape. This is the only place a real one is available to check that narrowing against.
  it("narrows a real ZodError", () => {
    let thrown: unknown = null
    try {
      z.object({ user_id: z.uuid() }).parse({ user_id: "not-a-uuid" })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(ZodError)

    const normalized = normalizeErrorForDisplay(thrown, t)
    expect(normalized.messageKey).toBe("response_validation_error")
    expect(normalized.status).toBe(422)
    expect(normalized.issues[0]?.path).toBe("user_id")
    expect(normalized.issues[0]?.code).toBe("invalid_format")
  })
})
