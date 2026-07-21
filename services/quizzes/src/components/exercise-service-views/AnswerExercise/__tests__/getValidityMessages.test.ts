import type { UserAnswer } from "../../../../../types/quizTypes/answer"
import { getQuizValidityMessages } from "../getValidityMessages"

// The parent renders these strings verbatim, so the identity translator keeps assertions readable.
const t = (key: string) => key

const timelineAnswer = (
  choices: { timelineItemId: string; chosenEventId: string }[],
  valid: boolean,
): UserAnswer => ({
  version: "2",
  itemAnswers: [{ type: "timeline", quizItemId: "t1", valid, timelineChoices: choices }],
})

describe("getQuizValidityMessages", () => {
  it("returns no messages when every item is answered and valid", () => {
    const state = timelineAnswer([{ timelineItemId: "a", chosenEventId: "e1" }], true)
    expect(getQuizValidityMessages(state, 1, t)).toEqual([])
  })

  it("asks the student to answer all parts when some items are unanswered", () => {
    const state: UserAnswer = { version: "2", itemAnswers: [] }
    expect(getQuizValidityMessages(state, 2, t)).toContain("answer-all-parts-of-the-exercise")
  })

  it("reports the timeline duplicate reason when the same option is chosen twice", () => {
    const state = timelineAnswer(
      [
        { timelineItemId: "a", chosenEventId: "dup" },
        { timelineItemId: "b", chosenEventId: "dup" },
      ],
      false,
    )
    expect(getQuizValidityMessages(state, 1, t)).toContain("timeline-duplicate-answer-error")
  })

  it("falls back to a generic reason for other invalid answers", () => {
    const state: UserAnswer = {
      version: "2",
      itemAnswers: [
        { type: "multiple-choice", quizItemId: "m1", valid: false, selectedOptionIds: [] },
      ],
    }
    expect(getQuizValidityMessages(state, 1, t)).toContain("check-your-answer")
  })

  it("de-duplicates repeated reasons", () => {
    const state: UserAnswer = {
      version: "2",
      itemAnswers: [
        { type: "multiple-choice", quizItemId: "m1", valid: false, selectedOptionIds: [] },
        { type: "multiple-choice", quizItemId: "m2", valid: false, selectedOptionIds: [] },
      ],
    }
    expect(getQuizValidityMessages(state, 2, t)).toEqual(["check-your-answer"])
  })

  it("returns no messages for a null state with no required items", () => {
    expect(getQuizValidityMessages(null, 0, t)).toEqual([])
  })
})
