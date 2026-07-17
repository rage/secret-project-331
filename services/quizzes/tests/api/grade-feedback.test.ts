/**
 * @vitest-environment node
 */

import { handleGrade } from "@/server/grade"

import type { UserAnswer } from "../../types/quizTypes/answer"
import type { ItemAnswerFeedback } from "../../types/quizTypes/grading"
import type {
  multipleChoiceMultipleOptionsGradingPolicy,
  PrivateSpecQuiz,
  PrivateSpecQuizItemMultiplechoice,
  QuizFeedbackMessage,
  QuizItemOption,
  QuizOptionFeedbackMessage,
} from "../../types/quizTypes/privateSpec"
import testClient from "./utils/appRouterTestClient"

const client = testClient(handleGrade)

interface ItemConfig {
  id: string
  numberOfOptions: number
  numberOfCorrect: number
  policy: multipleChoiceMultipleOptionsGradingPolicy
  selected: string[]
  itemFeedbackMessages?: QuizFeedbackMessage[]
  optionFeedback?: Record<string, QuizOptionFeedbackMessage[]>
}

const optionId = (itemId: string, index: number) => `${itemId}-option-${index + 1}`

function buildMultipleChoiceRequest(items: ItemConfig[], quizFeedback: QuizFeedbackMessage[] = []) {
  const specItems: PrivateSpecQuizItemMultiplechoice[] = items.map((config) => {
    const options: QuizItemOption[] = []
    for (let i = 0; i < config.numberOfOptions; i++) {
      const id = optionId(config.id, i)
      options.push({
        id,
        order: i,
        correct: i < config.numberOfCorrect,
        title: `Option ${i + 1}`,
        body: null,
        feedbackMessages: config.optionFeedback?.[id] ?? [],
      })
    }
    return {
      type: "multiple-choice",
      id: config.id,
      order: 0,
      allowSelectingMultipleOptions: true,
      shuffleOptions: false,
      options,
      title: config.id,
      body: null,
      feedbackMessages: config.itemFeedbackMessages ?? [],
      optionDisplayDirection: "vertical",
      multipleChoiceMultipleOptionsGradingPolicy: config.policy,
      fogOfWar: false,
    }
  })

  const exercise_spec: PrivateSpecQuiz = {
    version: "4",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: specItems,
    title: "Feedback quiz",
    body: null,
    quizItemDisplayDirection: "vertical",
    feedbackMessages: quizFeedback,
  }

  const submission_data: UserAnswer = {
    version: "4",
    itemAnswers: items.map((config) => ({
      type: "multiple-choice",
      valid: true,
      quizItemId: config.id,
      selectedOptionIds: config.selected,
    })),
  }

  return { grading_update_url: "example", exercise_spec, submission_data }
}

async function gradeFeedback(request: unknown): Promise<ItemAnswerFeedback[]> {
  const response = await client.post("/api/grade").send(request)
  expect(response.status).toBe(200)
  return JSON.parse(response.text).feedback_json as ItemAnswerFeedback[]
}

const itemEntry = (feedbacks: ItemAnswerFeedback[], id: string) =>
  feedbacks.find((f) => f.quiz_item_id === id)
const quizEntry = (feedbacks: ItemAnswerFeedback[]) =>
  feedbacks.find((f) => f.quiz_item_id === null)

// One entry per visibility so a single grading run tells us exactly which one surfaced.
const allVisibilityItemFeedback: QuizFeedbackMessage[] = [
  { visibility: "after-any-answer", message: "ITEM_ANY" },
  { visibility: "after-correct-answer", message: "ITEM_CORRECT" },
  { visibility: "after-partially-correct-answer", message: "ITEM_PARTIAL" },
  { visibility: "after-incorrect-answer", message: "ITEM_INCORRECT" },
  { visibility: "on-model-solution", message: "ITEM_MODEL" },
]

describe("grade feedback per item correctness", () => {
  // 2 correct of 4 with points-off-incorrect-options: [1,2] => 1, [1] => 0.5, [3] => 0.
  const partialItem = (selected: string[]): ItemConfig => ({
    id: "item",
    numberOfOptions: 4,
    numberOfCorrect: 2,
    policy: "points-off-incorrect-options",
    selected,
    itemFeedbackMessages: allVisibilityItemFeedback,
  })

  test("correctness coefficient 1 shows the after-correct message only", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([partialItem([optionId("item", 0), optionId("item", 1)])]),
    )
    const entry = itemEntry(feedbacks, "item")!
    expect(entry.correctnessCoefficient).toBe(1)
    expect(entry.quiz_item_feedback).toContain("ITEM_ANY")
    expect(entry.quiz_item_feedback).toContain("ITEM_CORRECT")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_PARTIAL")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_INCORRECT")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_MODEL")
  })

  test("a partial coefficient shows the after-partially-correct message only", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([partialItem([optionId("item", 0)])]),
    )
    const entry = itemEntry(feedbacks, "item")!
    expect(entry.correctnessCoefficient).toBeGreaterThan(0)
    expect(entry.correctnessCoefficient).toBeLessThan(1)
    expect(entry.quiz_item_feedback).toContain("ITEM_ANY")
    expect(entry.quiz_item_feedback).toContain("ITEM_PARTIAL")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_CORRECT")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_INCORRECT")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_MODEL")
  })

  test("coefficient 0 shows the after-incorrect message only", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([partialItem([optionId("item", 2)])]),
    )
    const entry = itemEntry(feedbacks, "item")!
    expect(entry.correctnessCoefficient).toBe(0)
    expect(entry.quiz_item_feedback).toContain("ITEM_ANY")
    expect(entry.quiz_item_feedback).toContain("ITEM_INCORRECT")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_CORRECT")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_PARTIAL")
    expect(entry.quiz_item_feedback).not.toContain("ITEM_MODEL")
  })

  test("on-model-solution feedback never appears in feedback_json", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([partialItem([optionId("item", 0), optionId("item", 1)])]),
    )
    expect(JSON.stringify(feedbacks)).not.toContain("ITEM_MODEL")
  })

  test("multiple applicable messages are joined with a single space", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([
        {
          id: "item",
          numberOfOptions: 2,
          numberOfCorrect: 1,
          policy: "default",
          selected: [optionId("item", 0)],
          itemFeedbackMessages: [
            { visibility: "after-any-answer", message: "FIRST" },
            { visibility: "after-any-answer", message: "SECOND" },
          ],
        },
      ]),
    )
    expect(itemEntry(feedbacks, "item")!.quiz_item_feedback).toBe("FIRST SECOND")
  })
})

describe("grade option feedback", () => {
  test("when-selected-after-answer feedback shows only for selected options", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([
        {
          id: "item",
          numberOfOptions: 4,
          numberOfCorrect: 2,
          policy: "points-off-incorrect-options",
          selected: [optionId("item", 0)],
          optionFeedback: {
            [optionId("item", 0)]: [
              { visibility: "when-selected-after-answer", message: "OPTION_ONE_SELECTED" },
              { visibility: "on-model-solution", message: "OPTION_ONE_MODEL" },
            ],
            [optionId("item", 2)]: [
              { visibility: "when-selected-after-answer", message: "OPTION_THREE_SELECTED" },
            ],
          },
        },
      ]),
    )
    const entry = itemEntry(feedbacks, "item")!
    const optionFeedbacks = entry.quiz_item_option_feedbacks!
    expect(optionFeedbacks).toHaveLength(1)
    expect(optionFeedbacks[0]!.option_id).toBe(optionId("item", 0))
    expect(optionFeedbacks[0]!.option_feedback).toBe("OPTION_ONE_SELECTED")
    // Unselected option's message and the on-model-solution message must not surface.
    const asString = JSON.stringify(feedbacks)
    expect(asString).not.toContain("OPTION_THREE_SELECTED")
    expect(asString).not.toContain("OPTION_ONE_MODEL")
  })
})

describe("grade quiz-level feedback from the overall ratio", () => {
  const quizFeedback: QuizFeedbackMessage[] = [
    { visibility: "after-any-answer", message: "QUIZ_ANY" },
    { visibility: "after-correct-answer", message: "QUIZ_CORRECT" },
    { visibility: "after-partially-correct-answer", message: "QUIZ_PARTIAL" },
    { visibility: "after-incorrect-answer", message: "QUIZ_INCORRECT" },
  ]

  // Two single-correct items (default policy): picking option-1 => 1, option-2 => 0.
  const item = (id: string, selectCorrect: boolean): ItemConfig => ({
    id,
    numberOfOptions: 2,
    numberOfCorrect: 1,
    policy: "default",
    selected: [optionId(id, selectCorrect ? 0 : 1)],
  })

  test("an all-correct quiz drives the after-correct quiz-level message", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([item("a", true), item("b", true)], quizFeedback),
    )
    const entry = quizEntry(feedbacks)!
    expect(entry.quiz_item_id).toBeNull()
    expect(entry.correctnessCoefficient).toBe(1)
    expect(entry.quiz_item_feedback).toContain("QUIZ_ANY")
    expect(entry.quiz_item_feedback).toContain("QUIZ_CORRECT")
    expect(entry.quiz_item_feedback).not.toContain("QUIZ_PARTIAL")
    expect(entry.quiz_item_feedback).not.toContain("QUIZ_INCORRECT")
  })

  test("a mixed quiz drives the after-partially-correct quiz-level message", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([item("a", true), item("b", false)], quizFeedback),
    )
    const entry = quizEntry(feedbacks)!
    expect(entry.quiz_item_feedback).toContain("QUIZ_ANY")
    expect(entry.quiz_item_feedback).toContain("QUIZ_PARTIAL")
    expect(entry.quiz_item_feedback).not.toContain("QUIZ_CORRECT")
    expect(entry.quiz_item_feedback).not.toContain("QUIZ_INCORRECT")
  })

  test("an all-wrong quiz drives the after-incorrect quiz-level message", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([item("a", false), item("b", false)], quizFeedback),
    )
    const entry = quizEntry(feedbacks)!
    expect(entry.quiz_item_feedback).toContain("QUIZ_ANY")
    expect(entry.quiz_item_feedback).toContain("QUIZ_INCORRECT")
    expect(entry.quiz_item_feedback).not.toContain("QUIZ_CORRECT")
    expect(entry.quiz_item_feedback).not.toContain("QUIZ_PARTIAL")
  })

  test("the synthetic quiz-level entry is a single null-item entry with coefficient 1", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([item("a", true), item("b", false)], quizFeedback),
    )
    const quizEntries = feedbacks.filter((f) => f.quiz_item_id === null)
    expect(quizEntries).toHaveLength(1)
    expect(quizEntries[0]!.correctnessCoefficient).toBe(1)
    expect(quizEntries[0]!.quiz_item_option_feedbacks).toBeNull()
  })

  test("no quiz-level entry is added when there is no quiz feedback", async () => {
    const feedbacks = await gradeFeedback(
      buildMultipleChoiceRequest([item("a", true), item("b", false)], []),
    )
    expect(feedbacks.some((f) => f.quiz_item_id === null)).toBe(false)
  })
})

describe("grade quiz-level feedback with awardPointsEvenIfWrong", () => {
  const quizFeedback: QuizFeedbackMessage[] = [
    { visibility: "after-correct-answer", message: "QUIZ_CORRECT" },
    { visibility: "after-incorrect-answer", message: "QUIZ_INCORRECT" },
  ]

  // Two single-correct items, both answered wrong.
  const wrongItem = (id: string): ItemConfig => ({
    id,
    numberOfOptions: 2,
    numberOfCorrect: 1,
    policy: "default",
    selected: [optionId(id, 1)],
  })

  test("all-wrong answers get full points but the quiz-level after-correct message stays hidden", async () => {
    const request = buildMultipleChoiceRequest([wrongItem("a"), wrongItem("b")], quizFeedback)
    request.exercise_spec.awardPointsEvenIfWrong = true

    const response = await client.post("/api/grade").send(request)
    expect(response.status).toBe(200)
    const result = JSON.parse(response.text)
    // Points are awarded regardless of correctness ...
    expect(result.score_given).toBe(2)
    expect(result.score_maximum).toBe(2)

    // ... but quiz-level feedback keys off actual correctness, so "after-correct" must not show.
    const entry = quizEntry(result.feedback_json as ItemAnswerFeedback[])!
    expect(entry.quiz_item_feedback).toContain("QUIZ_INCORRECT")
    expect(entry.quiz_item_feedback).not.toContain("QUIZ_CORRECT")
  })
})

describe("grade migrates raw old spec blobs before generating feedback", () => {
  // Locks in the grade.ts fix: a stored v3 blob must be migrated so its old-style feedback fields
  // still reach the student.
  test("a raw v3 spec yields migrated item and quiz feedback", async () => {
    const rawV3Request = {
      grading_update_url: "example",
      exercise_spec: {
        version: "3",
        awardPointsEvenIfWrong: false,
        grantPointsPolicy: "grant_whenever_possible",
        title: "Legacy quiz",
        body: null,
        quizItemDisplayDirection: "vertical",
        submitMessage: "V3_SUBMIT_MESSAGE",
        items: [
          {
            type: "multiple-choice",
            shuffleOptions: false,
            id: "legacy-item",
            order: 0,
            allowSelectingMultipleOptions: false,
            fogOfWar: false,
            title: "Legacy",
            body: null,
            successMessage: "V3_SUCCESS_MESSAGE",
            failureMessage: null,
            messageOnModelSolution: null,
            sharedOptionFeedbackMessage: null,
            optionDisplayDirection: "vertical",
            multipleChoiceMultipleOptionsGradingPolicy: "default",
            options: [
              {
                id: "legacy-option-1",
                order: 0,
                correct: true,
                title: "Right",
                body: null,
                messageAfterSubmissionWhenSelected: null,
                additionalCorrectnessExplanationOnModelSolution: null,
              },
            ],
          },
        ],
      },
      submission_data: {
        version: "3",
        itemAnswers: [
          {
            type: "multiple-choice",
            valid: true,
            quizItemId: "legacy-item",
            selectedOptionIds: ["legacy-option-1"],
          },
        ],
      },
    }

    const feedbacks = await gradeFeedback(rawV3Request)
    expect(itemEntry(feedbacks, "legacy-item")!.quiz_item_feedback).toContain("V3_SUCCESS_MESSAGE")
    expect(quizEntry(feedbacks)!.quiz_item_feedback).toContain("V3_SUBMIT_MESSAGE")
  })
})
