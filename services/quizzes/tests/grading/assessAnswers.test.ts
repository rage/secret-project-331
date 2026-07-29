import { assessAnswers } from "../../src/grading/assessment"
import type { UserAnswer } from "../../types/quizTypes/answer"
import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

const multipleChoiceQuiz = (): PrivateSpecQuiz => ({
  version: "4",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  title: null,
  body: null,
  quizItemDisplayDirection: "vertical",
  feedbackMessages: [],
  items: [
    {
      type: "multiple-choice",
      id: "item-1",
      order: 0,
      shuffleOptions: false,
      allowSelectingMultipleOptions: false,
      fogOfWar: false,
      optionDisplayDirection: "vertical",
      multipleChoiceMultipleOptionsGradingPolicy: "default",
      title: null,
      body: null,
      feedbackMessages: [],
      options: [
        { id: "opt-1", order: 0, correct: true, title: "A", body: null, feedbackMessages: [] },
      ],
    },
  ],
})

describe("assessAnswers answer/item type-mismatch guard", () => {
  test("throws instead of scoring when the answer type differs from the quiz item type", () => {
    // A crafted 'scale' answer used to hit the always-correct scale branch on a multiple-choice item.
    const answer = {
      version: "4",
      itemAnswers: [{ type: "scale", quizItemId: "item-1", valid: true, scaleValue: 1 }],
    } as unknown as UserAnswer

    expect(() => assessAnswers(answer, multipleChoiceQuiz())).toThrow(
      "Answer type 'scale' does not match quiz item type 'multiple-choice' for item item-1",
    )
  })

  test("a matching answer type is assessed normally", () => {
    const answer = {
      version: "4",
      itemAnswers: [
        {
          type: "multiple-choice",
          quizItemId: "item-1",
          valid: true,
          selectedOptionIds: ["opt-1"],
        },
      ],
    } as unknown as UserAnswer

    const [grading] = assessAnswers(answer, multipleChoiceQuiz())
    expect(grading!.correctnessCoefficient).toBe(1)
  })
})
