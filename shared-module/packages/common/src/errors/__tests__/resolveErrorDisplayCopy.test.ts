import type { TFunction } from "i18next"

import { normalizeErrorForDisplay } from "../normalizeErrorForDisplay"
import { resolveErrorDisplayCopy } from "../resolveErrorDisplayCopy"

const translations: Record<string, string> = {
  "error-message-key.validation_error_with_metadata.title": "Invalid input",
  "error-message-key.validation_error_with_metadata.message":
    "Please check the highlighted content and try again.",
  "error-message-key.chapter_not_open_yet.title": "Chapter is closed",
  "error-message-key.chapter_not_open_yet.message": "This chapter is not open yet.",
  "error-message-key.authentication_required_for_exam_exercise.title": "Sign in required",
  "error-message-key.authentication_required_for_exam_exercise.message":
    "Please sign in to view exam exercises.",
  "error-issue-code.missing_exercise_type.message": "Missing exercise type for exercise task.",
}

const t = ((key: string, options?: { defaultValue?: string }): string =>
  translations[key] ?? options?.defaultValue ?? "") as unknown as TFunction

describe("resolveErrorDisplayCopy", () => {
  test("prefers localized issue-code message over generic message_key message", () => {
    const view = normalizeErrorForDisplay(
      {
        type: "validation_error",
        message_key: "validation_error_with_metadata",
        message: "Non-localized backend message",
        errors: [{ path: "exercise_type", code: "missing_exercise_type", message: "raw" }],
        metadata: { block_id: "block-1" },
      },
      t,
    )

    const resolved = resolveErrorDisplayCopy(view, t)

    expect(resolved.title).toBe("Invalid input")
    expect(resolved.message).toBe("Missing exercise type for exercise task.")
  })

  test("falls back to generic message_key message when issue code translation is missing", () => {
    const view = normalizeErrorForDisplay(
      {
        type: "validation_error",
        message_key: "validation_error_with_metadata",
        message: "Non-localized backend message",
        errors: [{ path: "exercise_type", code: "some_other_issue", message: "raw" }],
      },
      t,
    )

    const resolved = resolveErrorDisplayCopy(view, t)

    expect(resolved.title).toBe("Invalid input")
    expect(resolved.message).toBe("Please check the highlighted content and try again.")
  })

  test("uses localized copy for chapter_not_open_yet message key", () => {
    const view = normalizeErrorForDisplay(
      {
        type: "unauthorized",
        message_key: "chapter_not_open_yet",
        message: "Chapter is not open yet.",
        errors: [],
      },
      t,
    )

    const resolved = resolveErrorDisplayCopy(view, t)

    expect(resolved.title).toBe("Chapter is closed")
    expect(resolved.message).toBe("This chapter is not open yet.")
  })

  test("uses localized copy for authentication_required_for_exam_exercise message key", () => {
    const view = normalizeErrorForDisplay(
      {
        type: "unauthorized",
        message_key: "authentication_required_for_exam_exercise",
        message: "User must be authenticated to view exam exercises",
        errors: [],
      },
      t,
    )

    const resolved = resolveErrorDisplayCopy(view, t)

    expect(resolved.title).toBe("Sign in required")
    expect(resolved.message).toBe("Please sign in to view exam exercises.")
  })
})
