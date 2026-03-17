import assert from "node:assert/strict"
import test from "node:test"

test("export-answers exports grading and answer metadata", async () => {
  const importedRouteModule = await import("../export-answers/route.ts")
  const routeModule = importedRouteModule.default ?? importedRouteModule
  const { POST } = routeModule
  const response = await POST(
    new Request("http://localhost/api/export-answers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            private_spec: [
              { id: "id-1", name: "Correct option", correct: true },
              { id: "id-2", name: "Wrong option", correct: false },
            ],
            answer: { selectedOptionId: "id-1" },
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
    }),
  )

  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    columns: Array<{ key: string; header: string }>
    results: Array<{ rows: Array<Record<string, unknown>> }>
  }

  assert.ok(body.columns.some((column) => column.key === "correct_option_names"))
  assert.equal(body.results.length, 1)
  assert.equal(body.results[0].rows.length, 1)
  assert.deepEqual(body.results[0].rows[0], {
    selected_option_id: "id-1",
    selected_option_name: "Correct option",
    selected_option_correct: true,
    selected_option_found: true,
    correct_option_ids: "id-1",
    correct_option_names: "Correct option",
    grading_selected_option_is_correct: true,
    score_given: 1,
    grading_progress: "FullyGraded",
    feedback_text: "Good job!",
  })
})

test("export-answers handles unknown selected options", async () => {
  const importedRouteModule = await import("../export-answers/route.ts")
  const routeModule = importedRouteModule.default ?? importedRouteModule
  const { POST } = routeModule
  const response = await POST(
    new Request("http://localhost/api/export-answers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            private_spec: [{ id: "id-1", name: "Correct option", correct: true }],
            answer: { selectedOptionId: "missing-option" },
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
    }),
  )

  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    results: Array<{ rows: Array<Record<string, unknown>> }>
  }

  assert.deepEqual(body.results[0].rows[0], {
    selected_option_id: "missing-option",
    selected_option_name: null,
    selected_option_correct: null,
    selected_option_found: false,
    correct_option_ids: "id-1",
    correct_option_names: "Correct option",
    grading_selected_option_is_correct: false,
    score_given: 0,
    grading_progress: "FullyGraded",
    feedback_text: "Your answer was not correct",
  })
})

test("export-answers fails with invalid payload", async () => {
  const importedRouteModule = await import("../export-answers/route.ts")
  const routeModule = importedRouteModule.default ?? importedRouteModule
  const { POST } = routeModule
  const response = await POST(
    new Request("http://localhost/api/export-answers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  )

  assert.equal(response.status, 400)
})
