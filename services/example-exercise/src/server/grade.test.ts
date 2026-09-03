import { describe, expect, it } from "vitest"

import { handleGrade } from "./grade"

/** Fills in the envelope fields every grading request carries, so cases name only what they vary. */
function post(body: object): Request {
  return new Request("http://localhost/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grading_update_url: "http://x", submission_files: [], ...body }),
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
        exercise_spec: SPEC,
        submission_data: { selectedOptionId: "a" },
      }),
    )
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.score_given).toBe(1)
    expect(result.grading_progress).toBe("FullyGraded")
    expect(result.feedback_json).toEqual({ version: "1", selectedOptionIsCorrect: true })
  })

  it("gives zero for an incorrect option", async () => {
    const res = await handleGrade(
      post({
        exercise_spec: SPEC,
        submission_data: { selectedOptionId: "b" },
      }),
    )
    const result = (await res.json()) as Record<string, unknown>
    expect(result.score_given).toBe(0)
    expect(result.feedback_json).toEqual({ version: "1", selectedOptionIsCorrect: false })
  })

  it("gives zero and a null feedback when nothing was selected", async () => {
    const res = await handleGrade(
      post({
        exercise_spec: SPEC,
        submission_data: {},
      }),
    )
    const result = (await res.json()) as Record<string, unknown>
    expect(result.score_given).toBe(0)
    expect(result.feedback_json).toBeNull()
  })

  it("grades a versioned exercise_spec envelope and versioned answer (migrate-on-read)", async () => {
    const res = await handleGrade(
      post({
        exercise_spec: { version: "1", alternatives: SPEC },
        submission_data: { version: "1", selectedOptionId: "a" },
      }),
    )
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.score_given).toBe(1)
    expect(result.feedback_json).toEqual({ version: "1", selectedOptionIsCorrect: true })
  })

  it("rejects a malformed grading request with 400", async () => {
    // Overrides an envelope field `post` would otherwise supply, so the request really is malformed.
    const res = await handleGrade(post({ exercise_spec: SPEC, grading_update_url: undefined }))
    expect(res.status).toBe(400)
  })
})
