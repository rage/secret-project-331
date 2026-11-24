import type { StyleValidationResult } from "@/tmc/cli"

export const GRADING_FEEDBACK_KEYS = [
  "compile_failed",
  /** The tests could not be run. */
  "generic_error",
  "interrupted",
  "timed_out",
  "style_check_failed",
  "valgrind_failed",
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
  /** Null when the exercise's language has no style check or the check could not run. */
  validations?: StyleValidationResult | null
  /** Valgrind found errors, which fail the run without failing any single test. */
  valgrind_failed?: boolean
}

export interface FeedbackTestResult {
  name: string
  successful: boolean
  message: string
  points: string[]
  exception: string[]
}

/** What a view shows of a grading's `feedback_json`; every field tolerates a missing key. */
export interface ParsedFeedback {
  feedbackKey: GradingFeedbackKey | null
  feedbackDetail: string | null
  status: string | null
  testResults: FeedbackTestResult[]
  logs: Record<string, string>
  validations: StyleValidationResult | null
  valgrindFailed: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []

function parseTestResult(raw: unknown): FeedbackTestResult | null {
  if (!isRecord(raw)) {
    return null
  }
  const exception = raw["exception"]
  return {
    name: typeof raw["name"] === "string" ? raw["name"] : "",
    successful: raw["successful"] === true,
    message: typeof raw["message"] === "string" ? raw["message"] : "",
    points: strings(raw["points"]),
    exception: strings(exception),
  }
}

/** Reads a grading's `feedback_json` without trusting its shape. Null when it is not an object. */
export function parseFeedback(feedbackJson: unknown): ParsedFeedback | null {
  if (!isRecord(feedbackJson)) {
    return null
  }
  const key = feedbackJson["feedback_key"]
  const rawResults = feedbackJson["testResults"]
  const rawLogs = feedbackJson["logs"]
  const validations = feedbackJson["validations"]
  return {
    feedbackKey:
      typeof key === "string" && (GRADING_FEEDBACK_KEYS as readonly string[]).includes(key)
        ? (key as GradingFeedbackKey)
        : null,
    feedbackDetail:
      typeof feedbackJson["feedback_detail"] === "string" ? feedbackJson["feedback_detail"] : null,
    status: typeof feedbackJson["status"] === "string" ? feedbackJson["status"] : null,
    testResults: Array.isArray(rawResults)
      ? rawResults
          .map((raw) => parseTestResult(raw))
          .filter((r): r is FeedbackTestResult => r !== null)
      : [],
    logs: isRecord(rawLogs)
      ? Object.fromEntries(
          Object.entries(rawLogs).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {},
    validations: isRecord(validations) ? (validations as unknown as StyleValidationResult) : null,
    valgrindFailed: feedbackJson["valgrind_failed"] === true,
  }
}
