import { render, screen } from "@testing-library/react"

import type { UserItemAnswerMatrix } from "../../../../../../types/quizTypes/answer"
import type {
  ItemAnswerFeedback,
  MatrixScoreBreakdown,
} from "../../../../../../types/quizTypes/grading"
import type { ModelSolutionQuizItemMatrix } from "../../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemMatrix } from "../../../../../../types/quizTypes/publicSpec"
import MatrixSubmission from "../Matrix"

const publicItem: PublicSpecQuizItemMatrix = {
  type: "matrix",
  id: "matrix-1",
  order: 0,
}

const breakdown: MatrixScoreBreakdown = {
  correctCells: 3,
  incorrectCells: 1,
  missingCells: 0,
  extraCells: 0,
  keyCells: 4,
}

const feedback = (breakdownValue: MatrixScoreBreakdown | null): ItemAnswerFeedback => ({
  quiz_item_id: "matrix-1",
  quiz_item_feedback: null,
  quiz_item_option_feedbacks: null,
  timeline_item_feedbacks: null,
  matrix_cell_feedbacks: null,
  matrix_score_breakdown: breakdownValue,
  correctnessCoefficient: 0.75,
})

const modelSolution = (
  overrides: Partial<ModelSolutionQuizItemMatrix> = {},
): ModelSolutionQuizItemMatrix => ({
  type: "matrix",
  id: "matrix-1",
  order: 0,
  optionCells: [
    ["1", "2"],
    ["3", "4"],
  ],
  messagesOnModelSolution: [],
  gradingPolicy: "per-cell",
  tolerance: 0,
  ...overrides,
})

const answer: UserItemAnswerMatrix = {
  type: "matrix",
  valid: true,
  quizItemId: "matrix-1",
  matrix: [
    ["1", "9"],
    ["3", "4"],
  ],
}

const renderSubmission = (
  modelSolutionValue: ModelSolutionQuizItemMatrix | null,
  breakdownValue: MatrixScoreBreakdown | null = breakdown,
) =>
  render(
    <MatrixSubmission
      public_quiz_item={publicItem}
      quiz_direction="column"
      quiz_item_model_solution={modelSolutionValue}
      quiz_item_answer_feedback={feedback(breakdownValue)}
      user_quiz_item_answer={answer}
      // oxlint-disable-next-line typescript/no-explicit-any
      user_information={{} as any}
    />,
  )

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("Matrix submission score breakdown", () => {
  it("adds the per-entry cost note under per-cell grading", () => {
    renderSubmission(modelSolution({ gradingPolicy: "per-cell" }))
    expect(screen.getByText("matrix-score-breakdown-per-cell-note")).toBeInTheDocument()
    expect(screen.queryByText("matrix-score-breakdown-whole-matrix-note")).not.toBeInTheDocument()
  })

  it("adds the all-or-nothing note under whole-matrix grading, not the per-entry cost note", () => {
    renderSubmission(modelSolution({ gradingPolicy: "whole-matrix" }))
    expect(screen.getByText("matrix-score-breakdown-whole-matrix-note")).toBeInTheDocument()
    expect(screen.queryByText("matrix-score-breakdown-per-cell-note")).not.toBeInTheDocument()
  })

  it("adds neither note when the grading policy is not known yet", () => {
    renderSubmission(null)
    expect(screen.getByText("matrix-score-breakdown", { exact: false })).toBeInTheDocument()
    expect(screen.queryByText("matrix-score-breakdown-per-cell-note")).not.toBeInTheDocument()
    expect(screen.queryByText("matrix-score-breakdown-whole-matrix-note")).not.toBeInTheDocument()
  })
})
