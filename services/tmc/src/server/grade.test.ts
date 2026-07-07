import { describe, expect, it } from "vitest"

import { handleGrade } from "./grade"

// The grading happy path shells out to tmc-langs-cli and runs a Kubernetes sandbox pod, so unit
// tests cover the request validation layer; the full flow is exercised by the system tests.
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
        submission_data: { type: "editor", archive_download_url: "http://y" },
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Invalid grading request")
  })

  it("rejects a grading request without submission data with 400", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: { type: "editor", repository_exercise: REPOSITORY_EXERCISE },
        submission_data: null,
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("unexpected submission type")
  })

  it("rejects a submission whose type does not match the exercise spec with 400", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: { type: "editor", repository_exercise: REPOSITORY_EXERCISE },
        submission_data: { type: "browser", files: [] },
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("unexpected submission type 'editor'")
  })
})
