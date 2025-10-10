import { POST } from "../../src/app/api/grade/route"

import testClient from "./utils/appRouterTestClient"
import { oldGenerateMultipleChoiceRequest } from "./utils/oldQuizGenerator"
import {
  generateChooseNGradingRequest,
  generateMultipleChoiceGradingRequest,
  generateTimelineGradingRequest,
  generateUnknownItemTypeGradingRequest,
} from "./utils/privateSpecGenerator"

import { ExerciseTaskGradingResult } from "@/shared-module/common/bindings"
import { isExerciseTaskGradingResult } from "@/shared-module/common/bindings.guard"

const client = testClient(POST)

describe("grade", () => {
  it("returns correct format", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 2, ["option-1"], "default")
    const response = await client.post("/api/grade").send(data)
    expect(isExerciseTaskGradingResult(JSON.parse(response.text)))
  })

  // Non multiple-choice
  it("returns full points for correct answer for single choice multiple-option quiz", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 1, ["option-1"], "default", false)
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it("returns full points from single choice version when one of the correct answers is selected", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 2, ["option-1"], "default", false)
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it("returns zero points single choice version when there are no right answers", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 0, ["option-1"], "default", false)
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points for wrong answer for single choice multiple-option quiz", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 1, ["option-3"], "default", false)
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("does not allow multiple choice for single choice multiple-option quiz", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 1, ["option-1", "option-3"], "default", false)
    await client.post("/api/grade").send(data).expect(500)
  })

  // Default, no points if all options aren't correct or all correct options are selected
  it("returns full points for correct answer in default", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 2, ["option-1", "option-2"], "default")
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it("returns zero points if a wrong answer is selected", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 2, ["option-1", "option-3"], "default")
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points if a wrong answer and all correct options are selected", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      4,
      2,
      ["option-1", "option-2", "option-3"],
      "default",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points if only wrong answers are selected", async () => {
    const data = oldGenerateMultipleChoiceRequest(4, 2, ["option-4", "option-3"], "default")
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  // Points off incorrect answers
  it("returns full points for all correct options in points-off-incorrect-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      4,
      2,
      ["option-1", "option-2"],
      "points-off-incorrect-options",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it("removes point for incorrect option in points-off-incorrect-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      4,
      2,
      ["option-1", "option-2", "option-3"],
      "points-off-incorrect-options",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.5)
  })

  it("returns zero if all options are selected in points-off-incorrect-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      4,
      2,
      ["option-1", "option-2", "option-3", "option-4"],
      "points-off-incorrect-options",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  // Points of unselected answers
  it("returns full points for correct answer in points-off-unselected-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      4,
      2,
      ["option-1", "option-2"],
      "points-off-unselected-options",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it("removes a point if one correct option is not selected in points-off-unselected-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      8,
      4,
      ["option-1", "option-2", "option-3"],
      "points-off-unselected-options",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.5)
  })

  it("removes a point if incorrect option is selected in points-off-unselected-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      8,
      4,
      ["option-1", "option-2", "option-3", "option-4", "option-5"],
      "points-off-unselected-options",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.75)
  })

  it("removes a point if incorrect option is selected and correct option is not seleccted in points-off-unselected-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      8,
      4,
      ["option-1", "option-2", "option-3", "option-5"],
      "points-off-unselected-options",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.25)
  })

  //Some correct, none incorrect
  it("returns full points for all correct answers in multiple-choice-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      3,
      3,
      ["option-1", "option-2", "option-3"],
      "some-correct-none-incorrect",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it("returns full points for some correct answers in multiple-choice-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      6,
      6,
      ["option-1", "option-2", "option-3"],
      "some-correct-none-incorrect",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it("returns zero points if correct answer and wrong answer is selected in multiple-choice-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(
      6,
      3,
      ["option-1", "option-6"],
      "some-correct-none-incorrect",
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points for wrong answer in multiple-choice-options", async () => {
    const data = oldGenerateMultipleChoiceRequest(6, 3, ["option-6"], "some-correct-none-incorrect")
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  // Test edge case: quiz item with zero correct options defined (division by zero bug fix)
  it("returns zero points when quiz item defines no correct options (default policy)", async () => {
    const data = generateMultipleChoiceGradingRequest(4, 0, ["option-1"], "default", true)
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points when quiz item defines no correct options (points-off-incorrect-options)", async () => {
    const data = generateMultipleChoiceGradingRequest(
      4,
      0,
      ["option-1"],
      "points-off-incorrect-options",
      true,
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points when quiz item defines no correct options (points-off-unselected-options)", async () => {
    const data = generateMultipleChoiceGradingRequest(
      4,
      0,
      ["option-1"],
      "points-off-unselected-options",
      true,
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points when quiz item defines no correct options (some-correct-none-incorrect)", async () => {
    const data = generateMultipleChoiceGradingRequest(
      4,
      0,
      ["option-1"],
      "some-correct-none-incorrect",
      true,
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  // Test edge case: correct options exist but student selected only wrong options
  it("returns zero points when student selects only incorrect options (default policy)", async () => {
    const data = generateMultipleChoiceGradingRequest(
      4,
      2,
      ["option-3", "option-4"],
      "default",
      true,
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points when student selects only incorrect options (points-off-incorrect-options)", async () => {
    const data = generateMultipleChoiceGradingRequest(
      4,
      2,
      ["option-3", "option-4"],
      "points-off-incorrect-options",
      true,
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points when student selects only incorrect options (points-off-unselected-options)", async () => {
    const data = generateMultipleChoiceGradingRequest(
      4,
      2,
      ["option-3", "option-4"],
      "points-off-unselected-options",
      true,
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points when student selects only incorrect options (some-correct-none-incorrect)", async () => {
    const data = generateMultipleChoiceGradingRequest(
      4,
      2,
      ["option-3", "option-4"],
      "some-correct-none-incorrect",
      true,
    )
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  // Test edge case: student selects no options at all
  it("returns error when student selects no options", async () => {
    const data = generateMultipleChoiceGradingRequest(4, 2, [], "default", true)
    const response = await client.post("/api/grade").send(data)

    // Empty selections should return an error (not crash with null score)
    expect(response.status).toBe(500)
    const result = JSON.parse(response.text)
    expect(result.error_message).toContain("No option answers")
  })

  it("returns zero points when choose-n quiz has no correct options", async () => {
    const data = generateChooseNGradingRequest(4, 0, ["option-1"], 2)
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns zero points when timeline has no items", async () => {
    const data = generateTimelineGradingRequest([], [])
    const response = await client.post("/api/grade").send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))

    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it("returns error for unknown item answer type", async () => {
    const data = generateUnknownItemTypeGradingRequest()
    const response = await client.post("/api/grade").send(data)

    expect(response.status).toBe(500)
    const result = JSON.parse(response.text)
    expect(result.error_message).toContain("Unexpected item answer type")
  })

  describe("choose-n grading", () => {
    it("returns full points when all n correct options are selected", async () => {
      const data = generateChooseNGradingRequest(6, 4, ["option-1", "option-2"], 2)
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(1)
    })

    it("returns partial points when some correct options are selected", async () => {
      const data = generateChooseNGradingRequest(6, 4, ["option-1"], 2)
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(0.5)
    })

    it("returns zero points when no correct options are selected", async () => {
      const data = generateChooseNGradingRequest(6, 2, ["option-3", "option-4"], 2)
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(0)
    })

    it("returns zero points when n is zero", async () => {
      const data = generateChooseNGradingRequest(4, 2, ["option-1"], 0)
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(0)
    })

    it("handles case where n is larger than total correct options", async () => {
      const data = generateChooseNGradingRequest(6, 2, ["option-1", "option-2"], 5)
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(1)
    })
  })

  describe("timeline grading", () => {
    it("returns full points when all timeline choices are correct", async () => {
      const data = generateTimelineGradingRequest(
        [
          { id: "1", year: "2000", correctEventName: "Event 1", correctEventId: "event-1" },
          { id: "2", year: "2001", correctEventName: "Event 2", correctEventId: "event-2" },
        ],
        [
          { timelineItemId: "1", chosenEventId: "event-1" },
          { timelineItemId: "2", chosenEventId: "event-2" },
        ],
      )
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(1)
    })

    it("returns partial points when some timeline choices are correct", async () => {
      const data = generateTimelineGradingRequest(
        [
          { id: "1", year: "2000", correctEventName: "Event 1", correctEventId: "event-1" },
          { id: "2", year: "2001", correctEventName: "Event 2", correctEventId: "event-2" },
          { id: "3", year: "2002", correctEventName: "Event 3", correctEventId: "event-3" },
          { id: "4", year: "2003", correctEventName: "Event 4", correctEventId: "event-4" },
        ],
        [
          { timelineItemId: "1", chosenEventId: "event-1" },
          { timelineItemId: "2", chosenEventId: "event-wrong" },
          { timelineItemId: "3", chosenEventId: "event-3" },
          { timelineItemId: "4", chosenEventId: "event-wrong" },
        ],
      )
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(0.5)
    })

    it("returns zero points when all timeline choices are incorrect", async () => {
      const data = generateTimelineGradingRequest(
        [
          { id: "1", year: "2000", correctEventName: "Event 1", correctEventId: "event-1" },
          { id: "2", year: "2001", correctEventName: "Event 2", correctEventId: "event-2" },
        ],
        [
          { timelineItemId: "1", chosenEventId: "event-wrong" },
          { timelineItemId: "2", chosenEventId: "event-wrong" },
        ],
      )
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(0)
    })

    it("returns one point for single correct timeline choice", async () => {
      const data = generateTimelineGradingRequest(
        [{ id: "1", year: "2000", correctEventName: "Event 1", correctEventId: "event-1" }],
        [{ timelineItemId: "1", chosenEventId: "event-1" }],
      )
      const response = await client.post("/api/grade").send(data)
      const result = JSON.parse(response.text)
      expect(isExerciseTaskGradingResult(result))

      const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
      expect(gradingResult.score_given).toBe(1)
    })
  })
})
