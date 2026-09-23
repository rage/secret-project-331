import { validatePrivateSpec } from "../../src/util/validatePrivateSpec"
import type {
  ClosedEndedQuestionGradingStrategy,
  PrivateSpecQuiz,
  PrivateSpecQuizItem,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemMatrix,
  QuizFeedbackMessage,
  QuizOptionFeedbackMessage,
} from "../../types/quizTypes/privateSpec"
import { generatePrivateSpecWithOneClosedEndedQuestionQuizItem } from "../api/utils/privateSpecGenerator"

const baseQuiz = (items: PrivateSpecQuizItem[]): PrivateSpecQuiz => ({
  version: "5",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  title: null,
  body: null,
  quizItemDisplayDirection: "vertical",
  feedbackMessages: [],
  items,
})

const closedEndedItem = (
  gradingStrategy: ClosedEndedQuestionGradingStrategy | null,
  formatRegex: string | null = null,
): PrivateSpecQuizItemClosedEndedQuestion => ({
  type: "closed-ended-question",
  id: "closed-1",
  order: 0,
  gradingStrategy,
  formatRegex,
  title: "Q",
  body: null,
  feedbackMessages: [],
})

const matrixItem = (
  overrides: Partial<PrivateSpecQuizItemMatrix> = {},
): PrivateSpecQuizItemMatrix => ({
  type: "matrix",
  id: "matrix-1",
  order: 0,
  title: null,
  optionCells: [
    ["1", "2"],
    ["3", "4"],
  ],
  feedbackMessages: [],
  gradingPolicy: "whole-matrix",
  tolerance: 0,
  partialCreditForWrongShape: false,
  fogOfWar: false,
  ...overrides,
})

const validClosed = baseQuiz([
  closedEndedItem({
    strategy: "exact-match",
    acceptedAnswers: ["Paris"],
    caseSensitive: false,
    trimWhitespace: true,
  }),
])

describe("validatePrivateSpec: valid specs", () => {
  test("a full generated spec passes", () => {
    expect(validatePrivateSpec(generatePrivateSpecWithOneClosedEndedQuestionQuizItem())).toBe(true)
  })

  test("a null spec is invalid", () => {
    expect(validatePrivateSpec(null)).toBe(false)
  })

  test("a minimal valid closed-ended spec passes", () => {
    expect(validatePrivateSpec(validClosed)).toBe(true)
  })
})

describe("validatePrivateSpec: closed-ended invariants", () => {
  test("a null grading strategy is invalid", () => {
    expect(validatePrivateSpec(baseQuiz([closedEndedItem(null)]))).toBe(false)
  })

  test("exact-match with zero non-empty accepted answers is invalid", () => {
    expect(
      validatePrivateSpec(
        baseQuiz([
          closedEndedItem({
            strategy: "exact-match",
            acceptedAnswers: ["", "   "],
            caseSensitive: false,
            trimWhitespace: true,
          }),
        ]),
      ),
    ).toBe(false)
  })

  test("exact-match with duplicates after case-insensitive normalization is invalid", () => {
    expect(
      validatePrivateSpec(
        baseQuiz([
          closedEndedItem({
            strategy: "exact-match",
            acceptedAnswers: ["Yes", "yes"],
            caseSensitive: false,
            trimWhitespace: true,
          }),
        ]),
      ),
    ).toBe(false)
  })

  test("an uncompilable regex pattern is invalid", () => {
    expect(
      validatePrivateSpec(
        baseQuiz([
          closedEndedItem({
            strategy: "regex",
            pattern: "(",
            caseSensitive: true,
            matchWholeAnswer: false,
            exampleCorrectAnswer: null,
          }),
        ]),
      ),
    ).toBe(false)
  })

  test("an empty regex pattern is invalid", () => {
    expect(
      validatePrivateSpec(
        baseQuiz([
          closedEndedItem({
            strategy: "regex",
            pattern: "   ",
            caseSensitive: true,
            matchWholeAnswer: false,
            exampleCorrectAnswer: null,
          }),
        ]),
      ),
    ).toBe(false)
  })

  test("a non-finite numeric correctValue is invalid", () => {
    expect(
      validatePrivateSpec(
        baseQuiz([
          closedEndedItem({
            strategy: "numeric",
            correctValue: Number.POSITIVE_INFINITY,
            tolerance: 0,
            acceptCommaAsDecimalSeparator: false,
          }),
        ]),
      ),
    ).toBe(false)
  })

  test("a negative numeric tolerance is invalid", () => {
    expect(
      validatePrivateSpec(
        baseQuiz([
          closedEndedItem({
            strategy: "numeric",
            correctValue: 3,
            tolerance: -1,
            acceptCommaAsDecimalSeparator: false,
          }),
        ]),
      ),
    ).toBe(false)
  })

  test("an uncompilable formatRegex is invalid", () => {
    expect(
      validatePrivateSpec(
        baseQuiz([
          closedEndedItem(
            {
              strategy: "exact-match",
              acceptedAnswers: ["Paris"],
              caseSensitive: false,
              trimWhitespace: true,
            },
            "(",
          ),
        ]),
      ),
    ).toBe(false)
  })
})

describe("validatePrivateSpec: matrix invariants", () => {
  test("a well-formed key is valid", () => {
    expect(validatePrivateSpec(baseQuiz([matrixItem()]))).toBe(true)
  })

  test("a key with a gap inside its own frame is invalid, since no student can reproduce it", () => {
    const gappedKey = [
      ["1", ""],
      ["", "4"],
    ]
    expect(validatePrivateSpec(baseQuiz([matrixItem({ optionCells: gappedKey })]))).toBe(false)
  })

  test("a negative tolerance is invalid", () => {
    expect(validatePrivateSpec(baseQuiz([matrixItem({ tolerance: -1 })]))).toBe(false)
  })

  test("a key with no cells at all is invalid, since it can never be answered correctly", () => {
    expect(validatePrivateSpec(baseQuiz([matrixItem({ optionCells: null })]))).toBe(false)
    expect(
      validatePrivateSpec(
        baseQuiz([
          matrixItem({
            optionCells: [
              ["", ""],
              ["", ""],
            ],
          }),
        ]),
      ),
    ).toBe(false)
  })
})

describe("validatePrivateSpec: feedback message invariants", () => {
  test("a quiz-level entry with an empty message is invalid", () => {
    const quiz = baseQuiz([])
    quiz.feedbackMessages = [{ visibility: "after-any-answer", message: "   " }]
    expect(validatePrivateSpec(quiz)).toBe(false)
  })

  test("an item-level entry with an unknown visibility is invalid", () => {
    const item = closedEndedItem({
      strategy: "exact-match",
      acceptedAnswers: ["Paris"],
      caseSensitive: false,
      trimWhitespace: true,
    })
    item.feedbackMessages = [
      { visibility: "not-a-real-visibility", message: "hi" } as unknown as QuizFeedbackMessage,
    ]
    expect(validatePrivateSpec(baseQuiz([item]))).toBe(false)
  })

  test("an option-level entry using an item-only visibility is invalid", () => {
    // Multiple-choice item so options exist; smuggle an item-only visibility onto an option.
    const withOptions = baseQuiz([
      {
        type: "multiple-choice",
        id: "mc-1",
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
          {
            id: "opt-1",
            order: 0,
            correct: true,
            title: "A",
            body: null,
            feedbackMessages: [
              {
                visibility: "after-correct-answer",
                message: "leaks",
              } as unknown as QuizOptionFeedbackMessage,
            ],
          },
        ],
      },
    ])
    expect(validatePrivateSpec(withOptions)).toBe(false)
  })
})
