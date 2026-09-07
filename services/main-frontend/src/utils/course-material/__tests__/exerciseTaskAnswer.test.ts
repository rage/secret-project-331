import { capturedAnswerToTaskSubmission } from "../exerciseTaskAnswer"

const TASK_ID = "00000000-0000-4000-8000-000000000000"
const FIRST_ID = "11111111-0000-4000-8000-000000000000"
const SECOND_ID = "22222222-0000-4000-8000-000000000000"

describe("capturedAnswerToTaskSubmission", () => {
  test("submits a json answer when the plugin reported no files", () => {
    expect(
      capturedAnswerToTaskSubmission(TASK_ID, { valid: true, data: { answer: "hello" } }),
    ).toEqual({
      exercise_task_id: TASK_ID,
      answer_kind: "json",
      data_json: { answer: "hello" },
    })
  })

  test("submits the file ids in the order the plugin reported them", () => {
    expect(
      capturedAnswerToTaskSubmission(TASK_ID, {
        valid: true,
        data: { display_names: ["a", "b"] },
        files: [SECOND_ID, FIRST_ID],
      }),
    ).toEqual({
      exercise_task_id: TASK_ID,
      answer_kind: "file",
      data_json: { display_names: ["a", "b"] },
      data_files: [SECOND_ID, FIRST_ID],
    })
  })

  test("a file answer whose plugin has no metadata submits a null data_json", () => {
    expect(
      capturedAnswerToTaskSubmission(TASK_ID, { valid: true, data: undefined, files: [FIRST_ID] }),
    ).toEqual({
      exercise_task_id: TASK_ID,
      answer_kind: "file",
      data_json: null,
      data_files: [FIRST_ID],
    })
  })

  test("an empty file list stays file-typed so the host rejects it instead of grading json", () => {
    expect(
      capturedAnswerToTaskSubmission(TASK_ID, { valid: false, data: null, files: [] }),
    ).toEqual({
      exercise_task_id: TASK_ID,
      answer_kind: "file",
      data_json: null,
      data_files: [],
    })
  })

  test("an uncaptured task submits an empty json answer", () => {
    expect(capturedAnswerToTaskSubmission(TASK_ID, undefined)).toEqual({
      exercise_task_id: TASK_ID,
      answer_kind: "json",
      data_json: null,
    })
  })
})
