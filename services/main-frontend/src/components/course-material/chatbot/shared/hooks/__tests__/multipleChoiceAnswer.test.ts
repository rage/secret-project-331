import { multipleChoiceAnswer } from "../../multipleChoiceQuestions"

/**
 * `ClientToolAnswer["data"]["result"]` is generated as an open record, so tsc accepts any key here.
 * These assertions are what actually pins the body to what
 * `AskMultipleChoiceQuestionTool::parse_response` deserializes; without them a rename ships green
 * and every answer is rejected at runtime.
 */
describe("multipleChoiceAnswer", () => {
  it("sends the chosen index under the key the backend deserializes", () => {
    expect(multipleChoiceAnswer(2)).toStrictEqual({
      type: "Data",
      data: { result: { choice_index: 2 } },
    })
  })

  it("keeps the first choice at index 0 rather than shifting to a 1-based position", () => {
    expect(multipleChoiceAnswer(0)).toStrictEqual({
      type: "Data",
      data: { result: { choice_index: 0 } },
    })
  })
})
