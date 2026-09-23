export type QuizzesGrading = QuizItemAnswerGrading[]

export interface OptionAnswerFeedback {
  option_id: string | null
  option_feedback: string | null
  this_option_was_correct: boolean | null
}

export interface TimelineItemFeedback {
  timeline_item_id: string | null
  what_was_chosen_was_correct: boolean
}

/**
 * How one cell of a matrix answer compares with the key.
 *
 * * `correct` / `incorrect` - the cell exists in both matrices.
 * * `missing` - the key has the cell, the student's matrix does not reach it.
 * * `extra` - the student typed the cell, the key's dimensions do not cover it.
 */
export type MatrixCellVerdict = "correct" | "incorrect" | "missing" | "extra"

export interface MatrixCellFeedback {
  row: number
  column: number
  verdict: MatrixCellVerdict
}

/**
 * The arithmetic behind a matrix item's score, so the student can check it by counting cells
 * rather than trusting the number.
 */
export interface MatrixScoreBreakdown {
  correctCells: number
  incorrectCells: number
  missingCells: number
  extraCells: number
  /** Cells in the key: the denominator each differing cell is charged against. */
  keyCells: number
}

/** The result of comparing a student's matrix with the key, cell by cell. */
export interface MatrixDifference {
  cellFeedbacks: MatrixCellFeedback[]
  breakdown: MatrixScoreBreakdown
}

export interface ItemAnswerFeedback {
  quiz_item_id: string | null
  /** Custom feedback message to be shown under the quiz item. */
  quiz_item_feedback: string | null
  quiz_item_option_feedbacks: OptionAnswerFeedback[] | null
  timeline_item_feedbacks: TimelineItemFeedback[] | null
  /** Null when the item is not a matrix, or when its fog of war withholds the verdicts. */
  matrix_cell_feedbacks: MatrixCellFeedback[] | null
  /** Null whenever `matrix_cell_feedbacks` is. */
  matrix_score_breakdown: MatrixScoreBreakdown | null
  /** The points for this quiz item will be multiplied with the correctness coefficient.
   *
   * For example, if this quiz item is worth 2 points and the correctness coefficient 0.75, the
   * user would get `2*0.75=1.5` points for this quiz item.
   *
   * * 0 will be regarded as an incorrect answer
   * * 0 < x < 1 will be regarded as a partially correct answer
   * * 1 will be regarded as a correct answer
   *
   */
  correctnessCoefficient: number
  score?: number
}

export interface QuizItemAnswerGrading {
  /** The points for this quiz item will be multiplied with the correctness coefficient.
   *
   * For example, if this quiz item is worth 2 points and the correctness coefficient 0.75, the
   * user would get `2*0.75=1.5` points for this quiz item.
   *
   * * 0 will be regarded as an incorrect answer
   * * 0 < x < 1 will be regarded as a partially correct answer
   * * 1 will be regarded as a correct answer
   *
   */
  correctnessCoefficient: number
  quizItemId: string
  /** Set only for matrix items; lets feedback rendering reuse the grader's comparison instead of redoing it. */
  matrixDifference?: MatrixDifference
}
