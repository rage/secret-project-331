import { describe, expect, it } from "vitest"

import { handleGrade } from "./grade"

// The grading happy path shells out to tmc-langs-cli and runs a Kubernetes sandbox pod, so unit
// tests cover the request validation layer; the full flow is exercised by the system tests.
function post(body: unknown): Request {
  return new Request("http://localhost/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/grade", () => {
  it("rejects a malformed grading request with 400", async () => {
    const res = await handleGrade(post({}))
    expect(res.status).toBe(400)
  })

  it("rejects a grading request without submission data with 400", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: { type: "editor" },
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
        exercise_spec: { type: "editor" },
        submission_data: { type: "browser", files: [] },
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("unexpected submission type 'editor'")
  })
})
