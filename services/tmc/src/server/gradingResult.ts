import type { RunStatus, StyleValidationResult, TestResult } from "@/tmc/cli"
import { isRunResult, isStyleValidationResult } from "@/tmc/cli.guard"
import type { ExerciseTaskGradingResult, GradingProgress } from "@/util/exerciseServiceApi"
import type { GradingFeedbackExtras, GradingFeedbackKey } from "@/util/gradingFeedback"
import type { TmcRunOutcome } from "@/util/podExecution"

/** How a sandbox run of `/tmc-run` ended, whichever sandbox ran it. */
export type RunOutcome =
  | TmcRunOutcome
  | { timedOut: true; timeLimitSeconds: number }
  | { outOfMemory: true }

const TIMED_OUT_FEEDBACK = "Test timed out"
const OUT_OF_MEMORY_FEEDBACK = "The tests ran out of memory"

/** What the student is told when grading failed on the service's side. */
export const SERVER_ERROR_FEEDBACK =
  "The submission could not be graded because of an error on the server. Try submitting again later."

/** A grading that says nothing about the answer, so the host does not count it as a try. */
export function failedGradingResult(
  feedbackText: string,
  extras: GradingFeedbackExtras,
): ExerciseTaskGradingResult {
  return {
    grading_progress: "Failed",
    score_given: 0,
    score_maximum: 0,
    feedback_text: feedbackText,
    feedback_json: extras,
  }
}

/** The grading for a failure on the service's side, where the student can only try again later. */
export function serverErrorResult(): ExerciseTaskGradingResult {
  return failedGradingResult(SERVER_ERROR_FEEDBACK, { feedback_key: "server_error" })
}

/**
 * The grading of a finished sandbox run.
 *
 * @throws when a run that finished wrote no tmc-langs run result.
 */
export function gradingResultFromRun(
  outcome: RunOutcome,
  points: string[],
): ExerciseTaskGradingResult {
  if ("outOfMemory" in outcome) {
    return failedGradingResult(OUT_OF_MEMORY_FEEDBACK, { feedback_key: "out_of_memory" })
  }
  if (outcome.timedOut) {
    const limit = "timeLimitSeconds" in outcome ? outcome.timeLimitSeconds : undefined
    return limit === undefined
      ? failedGradingResult(TIMED_OUT_FEEDBACK, { feedback_key: "timed_out" })
      : failedGradingResult(
          `The tests did not finish within the ${limit.toString()}-second time limit`,
          { feedback_key: "timed_out", time_limit_seconds: limit },
        )
  }

  const run = outcome.parsed
  if (!isRunResult(run)) {
    throw new Error(`/tmc-run wrote no tmc-langs run result: ${JSON.stringify(run)}`)
  }
  const validations = isStyleValidationResult(outcome.validations) ? outcome.validations : null
  const styleFailed = isStyleFailure(validations)
  // "Failed" is for runs that say nothing about the answer: the host does not count them as tries.
  let gradingProgress: GradingProgress = "Failed"
  let feedback: { text: string; key: GradingFeedbackKey } | null = null
  if (run.status === "COMPILE_FAILED") {
    gradingProgress = "FullyGraded"
    feedback = { text: "Could not compile the submission", key: "compile_failed" }
  } else if (run.status === "GENERIC_ERROR") {
    feedback = { text: "The tests could not be run", key: "generic_error" }
  } else if (run.status === "TESTRUN_INTERRUPTED") {
    feedback = { text: "Tests were interrupted", key: "interrupted" }
  } else {
    // The score already says whether the tests passed; clients show it as the result.
    gradingProgress = "FullyGraded"
    if (run.timedOutAfterMs !== undefined) {
      feedback = { text: TIMED_OUT_FEEDBACK, key: "timed_out" }
    } else if (styleFailed) {
      feedback = {
        text: "The code style check failed, so no points were given",
        key: "style_check_failed",
      }
    }
  }

  const extras: GradingFeedbackExtras = {
    feedback_key: feedback?.key ?? null,
    validations,
  }
  return {
    grading_progress: gradingProgress,
    ...runScore(run, points, { styleFailed }),
    feedback_text: feedback?.text ?? null,
    feedback_json: { ...run, ...extras },
  }
}

function isStyleFailure(validations: StyleValidationResult | null): boolean {
  return (
    validations?.strategy === "FAIL" && Object.keys(validations.validation_errors ?? {}).length > 0
  )
}

/**
 * Points as tmc-server awards them: each available point whose tests all passed. An exercise that
 * declares no points, such as a no-tests one, is scored out of one point, because the host awards
 * nothing for 0 of 0. A failed style check, or a run that did not finish the tests, earns nothing.
 */
export function runScore(
  run: { status: RunStatus; testResults: Pick<TestResult, "successful" | "points">[] },
  availablePoints: string[],
  checks: { styleFailed?: boolean } = {},
): { score_given: number; score_maximum: number } {
  const available = new Set(availablePoints)
  const scoreMaximum = Math.max(available.size, 1)
  const ranTests = run.status === "PASSED" || run.status === "TESTS_FAILED"
  if (!ranTests || checks.styleFailed === true) {
    return { score_given: 0, score_maximum: scoreMaximum }
  }
  if (available.size === 0) {
    const allPassed =
      run.status === "PASSED" &&
      run.testResults.length > 0 &&
      run.testResults.every((tr) => tr.successful)
    return { score_given: allPassed ? 1 : 0, score_maximum: 1 }
  }
  const pointPassed = new Map<string, boolean>()
  for (const test of run.testResults) {
    for (const point of test.points) {
      pointPassed.set(point, (pointPassed.get(point) ?? true) && test.successful)
    }
  }
  const earned = [...available].filter((point) => pointPassed.get(point) === true)
  return { score_given: earned.length, score_maximum: scoreMaximum }
}
