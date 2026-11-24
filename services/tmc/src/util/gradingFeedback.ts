import type { TFunction } from "i18next"

import type { RunResult, StyleValidationResult } from "@/tmc/cli"
import { isRunResult, isStyleValidationResult } from "@/tmc/cli.guard"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"

export const GRADING_FEEDBACK_KEYS = [
  "compile_failed",
  /** The tests could not be run. */
  "generic_error",
  "interrupted",
  "timed_out",
  "style_check_failed",
  "no_project_in_archive",
  /** tmc-langs rejected the answer. */
  "langs_error",
  /** The service's own fault. */
  "server_error",
] as const

/**
 * Stable identifier of a grading outcome, so views can translate what `feedback_text` says in
 * English. A run whose tests merely failed has no key.
 */
export type GradingFeedbackKey = (typeof GRADING_FEEDBACK_KEYS)[number]

/**
 * `feedback_json` of a tmc grading: the sandbox's tmc-langs run result (`status`, `testResults`,
 * `logs`, ...) with these keys added. When no run happened only `feedback_key` is set.
 */
export interface GradingFeedbackExtras {
  feedback_key: GradingFeedbackKey | null
  /** For `langs_error`: the cause tmc-langs gave, with server paths removed. */
  feedback_detail?: string
  /** Null when the exercise's language has no style check or the sandbox reported none. */
  validations?: StyleValidationResult | null
}

/** What a view shows of a grading's `feedback_json`. */
export interface ParsedFeedback {
  feedbackKey: GradingFeedbackKey | null
  feedbackDetail: string | null
  /** Null when no run happened or its result is not one tmc-langs wrote. */
  run: RunResult | null
  validations: StyleValidationResult | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** Reads a grading's `feedback_json` without trusting its shape. Null when it is not an object. */
export function parseFeedback(feedbackJson: unknown): ParsedFeedback | null {
  if (!isRecord(feedbackJson)) {
    return null
  }
  const key = feedbackJson["feedback_key"]
  const detail = feedbackJson["feedback_detail"]
  const validations = feedbackJson["validations"]
  return {
    feedbackKey:
      typeof key === "string" && (GRADING_FEEDBACK_KEYS as readonly string[]).includes(key)
        ? (key as GradingFeedbackKey)
        : null,
    feedbackDetail: typeof detail === "string" ? detail : null,
    run: isRunResult(feedbackJson) ? feedbackJson : null,
    validations: isStyleValidationResult(validations) ? validations : null,
  }
}

const FEEDBACK_MESSAGE_KEYS = {
  compile_failed: "feedback-compile-failed",
  generic_error: "feedback-generic-error",
  interrupted: "feedback-interrupted",
  timed_out: "feedback-timed-out",
  style_check_failed: "feedback-style-check-failed",
  no_project_in_archive: "feedback-no-project-in-archive",
  langs_error: "feedback-langs-error",
  server_error: "feedback-server-error",
} as const satisfies Record<GradingFeedbackKey, string>

/**
 * The grading's message in the viewer's language, falling back to the English `feedback_text` of
 * a grading that has no feedback key. Null when there is nothing to say.
 */
export function feedbackMessage(t: TFunction, grading: ExerciseTaskGradingResult): string | null {
  const feedback = parseFeedback(grading.feedback_json)
  if (feedback?.feedbackKey) {
    return t(FEEDBACK_MESSAGE_KEYS[feedback.feedbackKey], {
      detail: feedback.feedbackDetail ?? "",
    })
  }
  return grading.feedback_text?.trim() || null
}
