import { TFunction } from "i18next"

import { normalizeErrorForDisplay } from "../normalizeErrorForDisplay"
import { resolveErrorDisplayCopy } from "../resolveErrorDisplayCopy"

const translations: Record<string, string> = {
  "error-message-key.validation_error_with_metadata.title": "Invalid input",
  "error-message-key.validation_error_with_metadata.message":
    "Please check the highlighted content and try again.",
  "error-issue-code.missing_exercise_type.message": "Missing exercise type for exercise task.",
}

const t = ((key: string, options?: { defaultValue?: string }): string =>
  translations[key] ?? options?.defaultValue ?? "") as unknown as TFunction

describe("resolveErrorDisplayCopy", () => {
  test("prefers localized issue-code message over generic message_key message", () => {
    const view = normalizeErrorForDisplay({
      type: "validation_error",
      message_key: "validation_error_with_metadata",
      message: "Non-localized backend message",
      errors: [{ path: "exercise_type", code: "missing_exercise_type", message: "raw" }],
      metadata: { block_id: "block-1" },
    })

    const resolved = resolveErrorDisplayCopy(view, t)

    expect(resolved.title).toBe("Invalid input")
    expect(resolved.message).toBe("Missing exercise type for exercise task.")
  })

  test("falls back to generic message_key message when issue code translation is missing", () => {
    const view = normalizeErrorForDisplay({
      type: "validation_error",
      message_key: "validation_error_with_metadata",
      message: "Non-localized backend message",
      errors: [{ path: "exercise_type", code: "some_other_issue", message: "raw" }],
    })

    const resolved = resolveErrorDisplayCopy(view, t)

    expect(resolved.title).toBe("Invalid input")
    expect(resolved.message).toBe("Please check the highlighted content and try again.")
  })
})
