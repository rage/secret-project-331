import os from "node:os"

import { afterEach, describe, expect, it, vi } from "vitest"

import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import { LangsError } from "@/tmc/langs"

import {
  answerCompression,
  gradingFailureFeedback,
  gradingFailureKey,
  handleGrade,
  runScore,
  TemplateError,
} from "./grade"

vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))

// Grading shells out to tmc-langs-cli and a Kubernetes sandbox pod; unit tests cover request
// validation, system tests cover the full flow.
function post(body: unknown, gradingUpdateClaim: string | null = "claim"): Request {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (gradingUpdateClaim) {
    headers[EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER] = gradingUpdateClaim
  }
  return new Request("http://localhost/api/grade", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const REPOSITORY_EXERCISE = {
  id: "e48717c3-fd7d-41e9-a2e5-36ce06fcd943",
  repository_id: "4d24291f-dd61-43cc-83e2-4707a7278425",
  part: "part01",
  name: "ex01",
  repository_url: "https://github.com/testmycode/tmc-testcourse",
  checksum: [1, 2, 3, 4],
  download_url: "http://files.example/template.tar.zst",
}

const SUBMISSION_FILE = {
  id: "7d6c9ba0-1d31-4a2d-9f2e-4a2a6e0d3a11",
  name: "submission.tar.zst",
  mime: "application/x-zstd-compressed-tar",
  size_bytes: 1234,
  download_url: "http://files.example/submission.tar.zst",
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("POST /api/grade", () => {
  it("rejects invalid JSON with 400", async () => {
    const res = await handleGrade(post("not json"))
    expect(res.status).toBe(400)
  })

  it("rejects a malformed grading request with 400", async () => {
    const res = await handleGrade(post({}))
    expect(res.status).toBe(400)
  })

  it("rejects an exercise spec without a repository exercise with 400", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: { type: "editor" },
        submission_files: [SUBMISSION_FILE],
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Invalid grading request")
  })

  // A JSON-typed answer arrives with no files at all: ungradable, but not a service failure.
  it("rejects a grading request without submission files with 400", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: { type: "editor", repository_exercise: REPOSITORY_EXERCISE },
        submission_files: [],
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("submission_files")
  })

  it("rejects a grading request whose submission files are missing entirely with 400", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: { type: "editor", repository_exercise: REPOSITORY_EXERCISE },
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("submission_files")
  })

  it("rejects more than one submission file with 400, rather than grading only the first", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: { type: "editor", repository_exercise: REPOSITORY_EXERCISE },
        submission_files: [SUBMISSION_FILE, { ...SUBMISSION_FILE, name: "extra.tar.zst" }],
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("exactly one archive")
  })

  // The host sends null for a file stored before it recorded sizes, and tmc has no size limit of
  // its own, so an unknown size must not keep an answer from being graded.
  it("answers pending, then reports the grading even when the file size is unknown", async () => {
    const gradingUpdateUrl = "http://host/api/v0/exercise-services/grading/grading-update/1"
    const downloads: string[] = []
    const updates: { claim: string | null; body: unknown }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === gradingUpdateUrl) {
          const headers = new Headers(init?.headers)
          updates.push({
            claim: headers.get(EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER),
            body: JSON.parse(String(init?.body)),
          })
          return Promise.resolve(Response.json(null))
        }
        downloads.push(url)
        return Promise.reject(new Error("download stopped by the test"))
      }),
    )

    const res = await handleGrade(
      post(
        {
          grading_update_url: gradingUpdateUrl,
          exercise_spec: { type: "editor", repository_exercise: REPOSITORY_EXERCISE },
          submission_files: [{ ...SUBMISSION_FILE, size_bytes: null }],
        },
        "signed-claim",
      ),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ grading_progress: "Pending", score_given: 0 })

    await vi.waitFor(() => {
      expect(updates).toHaveLength(1)
    })
    expect(downloads).toEqual([SUBMISSION_FILE.download_url])
    expect(updates[0]).toEqual({
      claim: "signed-claim",
      body: expect.objectContaining({
        grading_progress: "Failed",
        score_given: 0,
        feedback_text:
          "The submission could not be graded because of an error on the server. Try submitting again later.",
      }),
    })
  })
})

describe("gradingFailureFeedback", () => {
  it("tells the student when the answer lacks the exercise's files", () => {
    const failure = new LangsError("No project directory found in archive", [
      "Caused by: No project directory found in archive",
    ])
    expect(gradingFailureFeedback(failure)).toBe(
      "The submission does not contain the exercise's files, so it could not be graded. Submit the whole exercise, including its source files.",
    )
  })

  it("blames the server, not the answer, when the template has no project", () => {
    const failure = new TemplateError(
      new LangsError("No project directory found in archive", [
        "Caused by: No project directory found in archive",
      ]),
    )
    expect(gradingFailureFeedback(failure)).toBe(
      "The submission could not be graded because of an error on the server. Try submitting again later.",
    )
  })

  it("names the innermost cause of any other tmc-langs failure", () => {
    const failure = new LangsError("Failed to prepare submission", [
      "Caused by: Failed to prepare submission",
      "Caused by: Failed to read file at src/main.py",
    ])
    expect(gradingFailureFeedback(failure)).toBe(
      "The submission could not be graded: Failed to read file at src/main.py",
    )
  })

  it("keeps the service's paths out of a tmc-langs cause", () => {
    const failure = new LangsError("Failed to prepare submission", [
      `Caused by: Failed to read ${os.tmpdir()}/a1b2c3/src/main.py and /app/config/limits.toml`,
    ])
    expect(gradingFailureFeedback(failure)).toBe(
      "The submission could not be graded: Failed to read src/main.py and limits.toml",
    )
  })

  it("keeps the details of the service's own failures out of the feedback", () => {
    const feedback = gradingFailureFeedback(
      new Error("GET http://files.example/a?download-claim=secret failed"),
    )
    expect(feedback).not.toContain("secret")
    expect(feedback).not.toContain("[object Object]")
  })
})

const test = (successful: boolean, ...points: string[]) => ({ successful, points })

describe("runScore", () => {
  const passed = { status: "PASSED" as const, testResults: [test(true)] }

  it("awards each point whose tests all passed", () => {
    const run = {
      status: "TESTS_FAILED" as const,
      testResults: [test(true, "1.1", "1.2"), test(false, "1.2"), test(true, "1.3")],
    }
    expect(runScore(run, ["1.1", "1.2", "1.3"])).toEqual({ score_given: 2, score_maximum: 3 })
  })

  it("counts only the points the exercise makes available", () => {
    const run = { status: "PASSED" as const, testResults: [test(true, "1.1", "extra")] }
    expect(runScore(run, ["1.1", "1.2"])).toEqual({ score_given: 1, score_maximum: 2 })
  })

  it("awards nothing for a run that did not finish the tests", () => {
    for (const status of ["COMPILE_FAILED", "GENERIC_ERROR", "TESTRUN_INTERRUPTED"] as const) {
      expect(runScore({ status, testResults: [test(true, "1.1")] }, ["1.1"])).toEqual({
        score_given: 0,
        score_maximum: 1,
      })
    }
  })

  it("awards nothing after a failed style check", () => {
    expect(runScore(passed, ["1.1"], { styleFailed: true })).toEqual({
      score_given: 0,
      score_maximum: 1,
    })
  })

  it("scores a passing exercise without points, such as a no-tests one, as full points", () => {
    expect(runScore(passed, [])).toEqual({ score_given: 1, score_maximum: 1 })
  })

  it("scores a failing exercise without points as zero", () => {
    const failed = { status: "TESTS_FAILED" as const, testResults: [test(false)] }
    expect(runScore(failed, [])).toEqual({ score_given: 0, score_maximum: 1 })
  })
})

describe("gradingFailureKey", () => {
  it("names the kind of failure", () => {
    expect(gradingFailureKey(new Error("boom"))).toBe("server_error")
    expect(gradingFailureKey(new TemplateError(new Error("x")))).toBe("server_error")
    expect(
      gradingFailureKey(new LangsError("x", ["Caused by: No project directory found in archive"])),
    ).toBe("no_project_in_archive")
    expect(gradingFailureKey(new LangsError("x", ["Caused by: bad zip"]))).toBe("langs_error")
  })
})

describe("answerCompression", () => {
  it("reads a zip upload as zip and anything else as the packed tar.zst", () => {
    expect(answerCompression({ name: "solution.ZIP", mime: "application/octet-stream" })).toBe(
      "zip",
    )
    expect(answerCompression({ name: "blob", mime: "application/x-zip-compressed" })).toBe("zip")
    expect(answerCompression({ name: "submission.tar.zst", mime: "application/zstd" })).toBe("zstd")
  })
})
