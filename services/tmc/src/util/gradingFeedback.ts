import type { TFunction } from "i18next"

import { isRecord } from "@/shared-module/common/utils/objects"
import type { RunResult, StyleValidationResult } from "@/tmc/cli"
import { isRunResult, isStyleValidationResult } from "@/tmc/cli.guard"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"

export const GRADING_FEEDBACK_KEYS = [
  "compile_failed",
  /** The tests could not be run. */
  "generic_error",
  "interrupted",
  "timed_out",
  "out_of_memory",
  "style_check_failed",
  "no_project_in_archive",
  /** tmc-langs rejected the answer. */
  "langs_error",
  /** The service's own fault. */
  "server_error",
  /** Every grading server stayed busy for as long as the service waits. */
  "sandbox_busy",
  "submission_too_large",
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
  /** For `timed_out`: the grading server's fixed run limit, when it has one. */
  time_limit_seconds?: number
  /** Null when the exercise's language has no style check or the sandbox reported none. */
  validations?: StyleValidationResult | null
}

/** What a view shows of a grading's `feedback_json`. */
export interface ParsedFeedback {
  feedbackKey: GradingFeedbackKey | null
  feedbackDetail: string | null
  timeLimitSeconds: number | null
  /** Null when no run happened or its result is not one tmc-langs wrote. */
  run: RunResult | null
  validations: StyleValidationResult | null
}

/** Reads a grading's `feedback_json` without trusting its shape. Null when it is not an object. */
export function parseFeedback(feedbackJson: unknown): ParsedFeedback | null {
  if (!isRecord(feedbackJson)) {
    return null
  }
  const key = feedbackJson["feedback_key"]
  const detail = feedbackJson["feedback_detail"]
  const timeLimitSeconds = feedbackJson["time_limit_seconds"]
  const validations = feedbackJson["validations"]
  return {
    feedbackKey:
      typeof key === "string" && (GRADING_FEEDBACK_KEYS as readonly string[]).includes(key)
        ? (key as GradingFeedbackKey)
        : null,
    feedbackDetail: typeof detail === "string" ? detail : null,
    timeLimitSeconds: typeof timeLimitSeconds === "number" ? timeLimitSeconds : null,
    run: isRunResult(feedbackJson) ? feedbackJson : null,
    validations: isStyleValidationResult(validations) ? validations : null,
  }
}

const FEEDBACK_MESSAGE_KEYS = {
  compile_failed: "feedback-compile-failed",
  generic_error: "feedback-generic-error",
  interrupted: "feedback-interrupted",
  timed_out: "feedback-timed-out",
  out_of_memory: "feedback-out-of-memory",
  style_check_failed: "feedback-style-check-failed",
  no_project_in_archive: "feedback-no-project-in-archive",
  langs_error: "feedback-langs-error",
  server_error: "feedback-server-error",
  sandbox_busy: "feedback-sandbox-busy",
  submission_too_large: "feedback-submission-too-large",
} as const satisfies Record<GradingFeedbackKey, string>

/**
 * The grading's message in the viewer's language, falling back to the English `feedback_text` of
 * a grading that has no feedback key. Null when there is nothing to say.
 */
export function feedbackMessage(t: TFunction, grading: ExerciseTaskGradingResult): string | null {
  const feedback = parseFeedback(grading.feedback_json)
  if (feedback?.feedbackKey === "timed_out" && feedback.timeLimitSeconds !== null) {
    return t("feedback-timed-out-limit", { seconds: feedback.timeLimitSeconds })
  }
  if (feedback?.feedbackKey) {
    return t(FEEDBACK_MESSAGE_KEYS[feedback.feedbackKey], {
      detail: feedback.feedbackDetail ?? "",
    })
  }
  return grading.feedback_text?.trim() || null
}
