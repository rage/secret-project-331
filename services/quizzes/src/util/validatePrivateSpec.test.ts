import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import { validatePrivateSpec } from "./validatePrivateSpec"

const quizWithTimelineYear = (year: string): PrivateSpecQuiz =>
  ({
    feedbackMessages: [],
    items: [
      {
        type: "timeline",
        id: "t",
        feedbackMessages: [],
        timelineItems: [{ id: "i", year, correctEventName: "Event", correctEventId: "e" }],
      },
    ],
  }) as unknown as PrivateSpecQuiz

describe("validatePrivateSpec timeline years", () => {
  it("accepts numeric years", () => {
    expect(validatePrivateSpec(quizWithTimelineYear("1969"))).toBe(true)
  })

  it("rejects empty and non-numeric years", () => {
    expect(validatePrivateSpec(quizWithTimelineYear(""))).toBe(false)
    expect(validatePrivateSpec(quizWithTimelineYear("abc"))).toBe(false)
  })
})
