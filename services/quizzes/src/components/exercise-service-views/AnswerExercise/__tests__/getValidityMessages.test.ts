import type { UserAnswer } from "../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItem } from "../../../../../types/quizTypes/publicSpec"
import { getQuizValidityMessages } from "../getValidityMessages"

// The parent renders these strings verbatim, so the identity translator keeps assertions readable.
const t = (key: string) => key

const timelineAnswer = (
  choices: { timelineItemId: string; chosenEventId: string }[],
  valid: boolean,
): UserAnswer => ({
  version: "5",
  itemAnswers: [{ type: "timeline", quizItemId: "t1", valid, timelineChoices: choices }],
})

const essay = (minWords: number | null, maxWords: number | null) =>
  [
    { type: "essay", id: "e1", order: 0, title: null, body: null, minWords, maxWords },
  ] as unknown as PublicSpecQuizItem[]
const items = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    type: "multiple-choice",
    id: `i${i}`,
  })) as unknown as PublicSpecQuizItem[]
const tOpts = (key: string, options?: Record<string, number>) =>
  options ? `${key} ${JSON.stringify(options)}` : key

describe("getQuizValidityMessages", () => {
  it("returns no messages when every item is answered and valid", () => {
    const state = timelineAnswer([{ timelineItemId: "a", chosenEventId: "e1" }], true)
    expect(getQuizValidityMessages(state, items(1), t)).toEqual([])
  })

  it("asks the student to answer all parts when some items are unanswered", () => {
    const state: UserAnswer = { version: "5", itemAnswers: [] }
    expect(getQuizValidityMessages(state, items(2), t)).toContain(
      "answer-all-parts-of-the-exercise",
    )
  })

  it("reports the timeline duplicate reason when the same option is chosen twice", () => {
    const state = timelineAnswer(
      [
        { timelineItemId: "a", chosenEventId: "dup" },
        { timelineItemId: "b", chosenEventId: "dup" },
      ],
      false,
    )
    expect(getQuizValidityMessages(state, items(1), t)).toContain("timeline-duplicate-answer-error")
  })

  it("falls back to a generic reason for other invalid answers", () => {
    const state: UserAnswer = {
      version: "5",
      itemAnswers: [
        { type: "multiple-choice", quizItemId: "m1", valid: false, selectedOptionIds: [] },
      ],
    }
    expect(getQuizValidityMessages(state, items(1), t)).toContain("check-your-answer")
  })

  it("asks for the empty cells inside a gapped matrix to be filled in", () => {
    const state: UserAnswer = {
      version: "5",
      itemAnswers: [
        {
          type: "matrix",
          quizItemId: "x1",
          valid: false,
          matrix: [
            ["1", ""],
            ["", "4"],
          ],
        },
      ],
    }
    expect(getQuizValidityMessages(state, items(1), t)).toEqual(["matrix-fill-empty-cells"])
  })

  it("de-duplicates repeated reasons", () => {
    const state: UserAnswer = {
      version: "5",
      itemAnswers: [
        { type: "multiple-choice", quizItemId: "m1", valid: false, selectedOptionIds: [] },
        { type: "multiple-choice", quizItemId: "m2", valid: false, selectedOptionIds: [] },
      ],
    }
    expect(getQuizValidityMessages(state, items(2), t)).toEqual(["check-your-answer"])
  })

  it("returns no messages for a null state with no required items", () => {
    expect(getQuizValidityMessages(null, items(0), t)).toEqual([])
  })

  it("explains essay word-count reasons", () => {
    const state: UserAnswer = {
      version: "5",
      itemAnswers: [{ type: "essay", quizItemId: "e1", valid: false, textData: "one two" }],
    }
    expect(getQuizValidityMessages(state, essay(5, null), tOpts)).toEqual([
      'word-count-below-minimum {"count":2,"min":5}',
    ])
    expect(getQuizValidityMessages(state, essay(null, 1), tOpts)).toEqual([
      'word-count-above-maximum {"count":2,"max":1}',
    ])
  })
})
