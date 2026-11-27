// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

import { gradingResultFromRun } from "@/server/gradingResult"

import type { SandboxCallback } from "./callback"
import { outcomeFromCallback, sandboxCallbackSchema } from "./callback"

/** Bodies a sandbox server posted for real runs of the Python fixtures. */
function golden(name: string): SandboxCallback {
  const path = join(
    import.meta.dirname,
    "../../../tests/fixtures/sandbox-callbacks",
    `${name}.json`,
  )
  return sandboxCallbackSchema.parse(JSON.parse(readFileSync(path, "utf8")))
}

const logger = { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }

function grade(callback: SandboxCallback, points: string[]) {
  const outcome = outcomeFromCallback(callback, logger)
  if ("sandboxError" in outcome) {
    throw new Error("expected a run")
  }
  return gradingResultFromRun(outcome.run, points)
}

describe("outcomeFromCallback on captured sandbox bodies", () => {
  it("grades a passing run", () => {
    expect(grade(golden("finished-passed"), ["1.passing_exercise"])).toMatchObject({
      grading_progress: "FullyGraded",
      score_given: 1,
      score_maximum: 1,
      feedback_json: { status: "PASSED", feedback_key: null, validations: null },
    })
  })

  it("grades a run whose tests failed", () => {
    expect(grade(golden("finished-tests-failed"), ["1.failing_exercise"])).toMatchObject({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_json: { status: "TESTS_FAILED" },
    })
  })

  it("fails a timed-out run naming the sandbox's limit", () => {
    expect(grade(golden("timeout"), ["1.1"])).toMatchObject({
      grading_progress: "Failed",
      feedback_json: { feedback_key: "timed_out", time_limit_seconds: 180 },
    })
  })

  it("fails an out-of-memory run, whose test output is tmc-langs' error envelope", () => {
    expect(grade(golden("out-of-memory"), ["1.1"])).toMatchObject({
      grading_progress: "Failed",
      feedback_json: { feedback_key: "out_of_memory" },
    })
  })

  it("fails a tmc-langs failure without output as a generic error", () => {
    expect(grade(golden("failed-110-no-output"), ["1.1"])).toMatchObject({
      grading_progress: "Failed",
      feedback_json: { status: "GENERIC_ERROR", exitCode: 110, feedback_key: "generic_error" },
    })
  })

  it("reports the sandbox's own failure separately, for a resend", () => {
    expect(outcomeFromCallback(golden("failed-internal-error"), logger)).toEqual({
      sandboxError: "Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?",
    })
  })
})

describe("outcomeFromCallback", () => {
  const base = { token: "t", stdout: "", stderr: "", vm_log: "" }

  it("logs tmc-langs' error envelope on a failed run", () => {
    const envelope = { "output-kind": "output-data", result: "error", message: "boom" }
    const callback = sandboxCallbackSchema.parse({
      ...base,
      status: "failed",
      exit_code: "110",
      test_output: JSON.stringify(envelope),
    })
    const outcome = outcomeFromCallback(callback, logger)
    expect(outcome).toMatchObject({ run: { parsed: { status: "GENERIC_ERROR", exitCode: 110 } } })
    expect(logger.error).toHaveBeenCalledWith(
      "tmc-langs failed in the sandbox",
      expect.stringContaining("boom"),
    )
  })

  it("uses a run result tmc-langs wrote before failing", () => {
    const run = { status: "COMPILE_FAILED", testResults: [], logs: {} }
    const callback = sandboxCallbackSchema.parse({
      ...base,
      status: "failed",
      exit_code: "110",
      test_output: JSON.stringify(run),
    })
    expect(outcomeFromCallback(callback, logger)).toMatchObject({ run: { parsed: run } })
  })

  it("treats exit code 137 as out of memory", () => {
    const callback = sandboxCallbackSchema.parse({ ...base, status: "failed", exit_code: "137" })
    expect(outcomeFromCallback(callback, logger)).toEqual({ run: { outOfMemory: true } })
  })

  it("fails any other exit code as a generic error", () => {
    const callback = sandboxCallbackSchema.parse({ ...base, status: "failed", exit_code: "1" })
    expect(outcomeFromCallback(callback, logger)).toMatchObject({
      run: { parsed: { status: "GENERIC_ERROR", exitCode: 1 } },
    })
  })

  it("fails a crash as a generic error", () => {
    const callback = sandboxCallbackSchema.parse({ ...base, status: "crashed", exit_code: "2" })
    expect(outcomeFromCallback(callback, logger)).toMatchObject({
      run: { parsed: { status: "GENERIC_ERROR", exitCode: 2 } },
    })
  })

  it("marks unparseable test output as such", () => {
    const callback = sandboxCallbackSchema.parse({
      ...base,
      status: "finished",
      exit_code: "0",
      test_output: "{",
    })
    expect(outcomeFromCallback(callback, logger)).toMatchObject({
      run: { parsed: { status: "GENERIC_ERROR", error: "INVALID_TEST_OUTPUT_JSON" } },
    })
  })

  it("keeps only the tail of long logs", () => {
    const callback = sandboxCallbackSchema.parse({
      ...base,
      status: "failed",
      exit_code: "1",
      stdout: `${"a".repeat(20_000)}END`,
    })
    const outcome = outcomeFromCallback(callback, logger)
    const stdout = (outcome as { run: { parsed: { logs: { stdout: string } } } }).run.parsed.logs
      .stdout
    expect(stdout.length).toBe(8 * 1024)
    expect(stdout.endsWith("END")).toBe(true)
  })

  it("passes the style check through", () => {
    const validations = { strategy: "FAIL", validation_errors: {} }
    const callback = sandboxCallbackSchema.parse({
      ...base,
      status: "finished",
      exit_code: "0",
      test_output: JSON.stringify({ status: "PASSED", testResults: [], logs: {} }),
      validations: JSON.stringify(validations),
    })
    expect(outcomeFromCallback(callback, logger)).toMatchObject({ run: { validations } })
  })
})
