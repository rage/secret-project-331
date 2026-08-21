import { afterEach, describe, expect, it, vi } from "vitest"

import { handleGrade } from "./grade"

vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))

// Grading shells out to tmc-langs-cli and a Kubernetes sandbox pod; unit tests cover request
// validation, system tests cover the full flow.
function post(body: unknown): Request {
  return new Request("http://localhost/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  mime: "application/octet-stream",
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
  it("grades from the request's download url even when the file size is unknown", async () => {
    const downloads: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        downloads.push(url)
        return Promise.reject(new Error("download stopped by the test"))
      }),
    )
    await expect(
      handleGrade(
        post({
          grading_update_url: "http://x",
          exercise_spec: { type: "editor", repository_exercise: REPOSITORY_EXERCISE },
          submission_files: [{ ...SUBMISSION_FILE, size_bytes: null }],
        }),
      ),
    ).rejects.toThrow("download stopped by the test")
    expect(downloads).toEqual([SUBMISSION_FILE.download_url])
  })
})
