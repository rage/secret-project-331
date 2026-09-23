import { submissionFeedback } from "../../src/grading/feedback"
import type { UserAnswer } from "../../types/quizTypes/answer"
import type { PrivateSpecQuiz, PrivateSpecQuizItemMatrix } from "../../types/quizTypes/privateSpec"

const matrixItem = (
  overrides: Partial<PrivateSpecQuizItemMatrix> = {},
): PrivateSpecQuizItemMatrix => ({
  type: "matrix",
  id: "matrix-item",
  order: 0,
  title: null,
  optionCells: [
    ["1", "2"],
    ["3", "4"],
  ],
  feedbackMessages: [],
  gradingPolicy: "per-cell",
  tolerance: 0,
  partialCreditForWrongShape: true,
  fogOfWar: false,
  ...overrides,
})

const quiz = (item: PrivateSpecQuizItemMatrix): PrivateSpecQuiz => ({
  version: "5",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  title: null,
  body: null,
  quizItemDisplayDirection: "vertical",
  feedbackMessages: [],
  items: [item],
})

const answer = (matrix: string[][]): UserAnswer => ({
  version: "5",
  itemAnswers: [{ type: "matrix", valid: true, quizItemId: "matrix-item", matrix }],
})

const feedbackFor = (
  matrix: string[][],
  overrides: Partial<PrivateSpecQuizItemMatrix> = {},
  correctnessCoefficient = 0.5,
) =>
  submissionFeedback(
    answer(matrix),
    quiz(matrixItem(overrides)),
    [{ quizItemId: "matrix-item", correctnessCoefficient }],
    correctnessCoefficient,
  )[0]

describe("matrix feedback", () => {
  test("marks each cell the student can check against their own grid", () => {
    const feedback = feedbackFor([
      ["1", "9"],
      ["3", "4"],
    ])
    expect(feedback?.matrix_cell_feedbacks).toEqual([
      { row: 0, column: 0, verdict: "correct" },
      { row: 0, column: 1, verdict: "incorrect" },
      { row: 1, column: 0, verdict: "correct" },
      { row: 1, column: 1, verdict: "correct" },
    ])
  })

  test("separates an entry left out from an entry too many", () => {
    const feedback = feedbackFor([["1", "2", "9"]])
    expect(feedback?.matrix_cell_feedbacks).toContainEqual({ row: 0, column: 2, verdict: "extra" })
    expect(feedback?.matrix_cell_feedbacks).toContainEqual({
      row: 1,
      column: 0,
      verdict: "missing",
    })
    expect(feedback?.matrix_cell_feedbacks).toContainEqual({
      row: 1,
      column: 1,
      verdict: "missing",
    })
  })

  test("spells out the arithmetic behind the score", () => {
    expect(
      feedbackFor([
        ["1", "9"],
        ["3", "4"],
      ])?.matrix_score_breakdown,
    ).toEqual({
      correctCells: 3,
      incorrectCells: 1,
      missingCells: 0,
      extraCells: 0,
      keyCells: 4,
    })
  })

  test("says nothing per cell under fog of war, so repeated tries cannot uncover the answer", () => {
    const feedback = feedbackFor(
      [
        ["1", "9"],
        ["3", "4"],
      ],
      { fogOfWar: true },
    )
    expect(feedback?.matrix_cell_feedbacks).toBeNull()
    expect(feedback?.matrix_score_breakdown).toBeNull()
    expect(feedback?.correctnessCoefficient).toBe(0.5)
  })

  test("collapses the exact fraction under fog of war too, so retries can't bisect the key", () => {
    const matrix = [
      ["1", "9"],
      ["3", "4"],
    ]
    // Different fractions of correctness must not be distinguishable from one another; only
    // whether the answer was wrong, partial, or fully correct survives.
    expect(feedbackFor(matrix, { fogOfWar: true }, 0.25)?.correctnessCoefficient).toBe(0.5)
    expect(feedbackFor(matrix, { fogOfWar: true }, 0.75)?.correctnessCoefficient).toBe(0.5)
    expect(feedbackFor(matrix, { fogOfWar: true }, 0)?.correctnessCoefficient).toBe(0)
    expect(feedbackFor(matrix, { fogOfWar: true }, 1)?.correctnessCoefficient).toBe(1)
  })

  test("reveals the exact fraction when fog of war is off", () => {
    const matrix = [
      ["1", "9"],
      ["3", "4"],
    ]
    expect(feedbackFor(matrix, { fogOfWar: false }, 0.25)?.correctnessCoefficient).toBe(0.25)
  })
})
