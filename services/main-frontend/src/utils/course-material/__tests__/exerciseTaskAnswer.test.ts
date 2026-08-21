import { capturedAnswerToSubmittedAnswer } from "../exerciseTaskAnswer"

const FIRST_ID = "11111111-0000-4000-8000-000000000000"
const SECOND_ID = "22222222-0000-4000-8000-000000000000"

describe("capturedAnswerToSubmittedAnswer", () => {
  test("submits a json answer when the plugin reported no files", () => {
    expect(capturedAnswerToSubmittedAnswer({ valid: true, data: { answer: "hello" } })).toEqual({
      kind: "json",
      data: { answer: "hello" },
    })
  })

  test("submits the file ids in the order the plugin reported them", () => {
    expect(
      capturedAnswerToSubmittedAnswer({
        valid: true,
        data: { display_names: ["a", "b"] },
        files: [SECOND_ID, FIRST_ID],
      }),
    ).toEqual({
      kind: "file",
      file_upload_ids: [SECOND_ID, FIRST_ID],
      metadata: { display_names: ["a", "b"] },
    })
  })

  test("a file answer whose plugin has no metadata submits a null metadata", () => {
    expect(
      capturedAnswerToSubmittedAnswer({ valid: true, data: undefined, files: [FIRST_ID] }),
    ).toEqual({ kind: "file", file_upload_ids: [FIRST_ID], metadata: null })
  })

  test("an empty file list stays file-typed so the host rejects it instead of grading json", () => {
    expect(capturedAnswerToSubmittedAnswer({ valid: false, data: null, files: [] })).toEqual({
      kind: "file",
      file_upload_ids: [],
      metadata: null,
    })
  })

  test("an uncaptured task submits an empty json answer", () => {
    expect(capturedAnswerToSubmittedAnswer(undefined)).toEqual({ kind: "json", data: undefined })
  })
})
