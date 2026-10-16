import { describe, expect, it } from "vitest"

import { handleExportAnswers } from "./exportAnswers"

function post(body: unknown): Request {
  return new Request("http://localhost/api/export-answers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/export-answers", () => {
  it("exports grading and answer metadata", async () => {
    const res = await handleExportAnswers(
      post({
        items: [
          {
            private_spec: {
              version: "1",
              alternatives: [
                { id: "id-1", name: "Correct option", correct: true },
                { id: "id-2", name: "Wrong option", correct: false },
              ],
            },
            answer: { version: "1", selectedOptionId: "id-1" },
            grading: {
              score_given: 1,
              grading_progress: "FullyGraded",
              feedback_text: "Good job!",
              feedback_json: { selectedOptionIsCorrect: true },
            },
            model_solution_spec: null,
          },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { results: { rows: Record<string, unknown>[] }[] }
    expect(body.results[0]!.rows[0]).toEqual({
      selected_option_id: "id-1",
      selected_option_name: "Correct option",
      selected_option_correct: true,
      grading_selected_option_is_correct: true,
      score_given: 1,
    })
  })

  it("handles unknown selected options", async () => {
    const res = await handleExportAnswers(
      post({
        items: [
          {
            private_spec: {
              version: "1",
              alternatives: [{ id: "id-1", name: "Correct option", correct: true }],
            },
            answer: { version: "1", selectedOptionId: "missing-option" },
            grading: {
              score_given: 0,
              grading_progress: "FullyGraded",
              feedback_text: "Your answer was not correct",
              feedback_json: { selectedOptionIsCorrect: false },
            },
            model_solution_spec: null,
          },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { results: { rows: Record<string, unknown>[] }[] }
    expect(body.results[0]!.rows[0]).toEqual({
      selected_option_id: "missing-option",
      selected_option_name: null,
      selected_option_correct: null,
      grading_selected_option_is_correct: false,
      score_given: 0,
    })
  })

  it("defuses cells a spreadsheet would run as formulas", async () => {
    const res = await handleExportAnswers(
      post({
        items: [
          {
            private_spec: {
              version: "1",
              alternatives: [{ id: "=1+1", name: "@SUM(A1)", correct: true }],
            },
            answer: { version: "1", selectedOptionId: "=1+1" },
            grading: null,
            model_solution_spec: null,
          },
        ],
      }),
    )
    const body = (await res.json()) as { results: { rows: Record<string, unknown>[] }[] }
    expect(body.results[0]!.rows[0]).toMatchObject({
      selected_option_id: "'=1+1",
      selected_option_name: "'@SUM(A1)",
    })
  })

  it("fails with an invalid payload", async () => {
    const res = await handleExportAnswers(post({}))
    expect(res.status).toBe(400)
  })
})
