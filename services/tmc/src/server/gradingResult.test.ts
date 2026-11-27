import { describe, expect, it } from "vitest"

import type { RunOutcome } from "./gradingResult"
import { gradingResultFromRun } from "./gradingResult"

const finished = (parsed: unknown, validations: unknown = null): RunOutcome => ({
  timedOut: false,
  output: JSON.stringify(parsed),
  parsed,
  validations,
})

const passingTest = { name: "t", successful: true, points: ["1.1"], message: "", exception: [] }
const failingTest = { ...passingTest, successful: false }

describe("gradingResultFromRun", () => {
  it.each<[string, RunOutcome, object]>([
    [
      "passed",
      finished({ status: "PASSED", testResults: [passingTest], logs: {} }),
      { grading_progress: "FullyGraded", score_given: 1, score_maximum: 1, feedback_text: null },
    ],
    [
      "tests failed",
      finished({ status: "TESTS_FAILED", testResults: [failingTest], logs: {} }),
      { grading_progress: "FullyGraded", score_given: 0, score_maximum: 1, feedback_text: null },
    ],
    [
      "compile failed",
      finished({ status: "COMPILE_FAILED", testResults: [], logs: {} }),
      {
        grading_progress: "FullyGraded",
        score_given: 0,
        feedback_json: expect.objectContaining({ feedback_key: "compile_failed" }),
      },
    ],
    [
      "generic error",
      finished({ status: "GENERIC_ERROR", testResults: [], logs: {} }),
      {
        grading_progress: "Failed",
        feedback_json: expect.objectContaining({ feedback_key: "generic_error" }),
      },
    ],
    [
      "interrupted",
      finished({ status: "TESTRUN_INTERRUPTED", testResults: [], logs: {} }),
      {
        grading_progress: "Failed",
        feedback_json: expect.objectContaining({ feedback_key: "interrupted" }),
      },
    ],
    [
      "a pod run that timed out",
      { timedOut: true },
      {
        grading_progress: "Failed",
        feedback_text: "Test timed out",
        feedback_json: { feedback_key: "timed_out" },
      },
    ],
    [
      "a remote run that hit the sandbox's limit",
      { timedOut: true, timeLimitSeconds: 180 },
      {
        grading_progress: "Failed",
        feedback_text: "The tests did not finish within the 180-second time limit",
        feedback_json: { feedback_key: "timed_out", time_limit_seconds: 180 },
      },
    ],
    [
      "out of memory",
      { outOfMemory: true },
      {
        grading_progress: "Failed",
        score_given: 0,
        feedback_json: { feedback_key: "out_of_memory" },
      },
    ],
    [
      "a failed style check",
      finished(
        { status: "PASSED", testResults: [passingTest], logs: {} },
        {
          strategy: "FAIL",
          validation_errors: {
            "A.java": [{ column: 1, line: 1, message: "indent", source_name: "Indentation" }],
          },
        },
      ),
      {
        grading_progress: "FullyGraded",
        score_given: 0,
        feedback_json: expect.objectContaining({ feedback_key: "style_check_failed" }),
      },
    ],
  ])("grades %s", (_name, outcome, expected) => {
    expect(gradingResultFromRun(outcome, ["1.1"])).toMatchObject(expected)
  })

  it("throws on a finished run without a tmc-langs run result", () => {
    expect(() => gradingResultFromRun(finished({ nope: true }), [])).toThrow(
      /no tmc-langs run result/,
    )
  })
})
