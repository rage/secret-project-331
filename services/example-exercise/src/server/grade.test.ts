import { describe, expect, it } from "vitest"

import { handleGrade } from "./grade"

function post(body: unknown): Request {
  return new Request("http://localhost/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const SPEC = [
  { id: "a", name: "Right", correct: true },
  { id: "b", name: "Wrong", correct: false },
]

describe("POST /api/grade", () => {
  it("gives full score for the correct option", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: SPEC,
        submission_data: { selectedOptionId: "a" },
      }),
    )
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.score_given).toBe(1)
    expect(result.grading_progress).toBe("FullyGraded")
    expect(result.feedback_json).toEqual({ selectedOptionIsCorrect: true })
  })

  it("gives zero for an incorrect option", async () => {
    const res = await handleGrade(
      post({
        grading_update_url: "http://x",
        exercise_spec: SPEC,
        submission_data: { selectedOptionId: "b" },
      }),
    )
    const result = (await res.json()) as Record<string, unknown>
    expect(result.score_given).toBe(0)
    expect(result.feedback_json).toEqual({ selectedOptionIsCorrect: false })
  })

  it("gives zero and a null feedback when nothing was selected", async () => {
    const res = await handleGrade(
      post({ grading_update_url: "http://x", exercise_spec: SPEC, submission_data: {} }),
    )
    const result = (await res.json()) as Record<string, unknown>
    expect(result.score_given).toBe(0)
    expect(result.feedback_json).toBeNull()
  })

  it("rejects a malformed grading request with 400", async () => {
    const res = await handleGrade(post({ exercise_spec: SPEC }))
    expect(res.status).toBe(400)
  })
})
