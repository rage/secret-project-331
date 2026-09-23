import {
  blankCellsInsideShape,
  cellsMatch,
  isBlankCell,
  MATRIX_GRID_SIZE,
  matrixShape,
  type MatrixShape,
} from "@/util/matrix"

import type { MatrixCellFeedback, MatrixScoreBreakdown } from "../../../types/quizTypes/grading"

export interface MatrixDifference {
  cellFeedbacks: MatrixCellFeedback[]
  breakdown: MatrixScoreBreakdown
  /** Cells that must change to turn the answer into the key: incorrect + missing + extra. */
  differingCells: number
  shapesMatch: boolean
  studentShape: MatrixShape
  keyShape: MatrixShape
}

/**
 * Compare a student's matrix with the key, cell by cell, over the positions either of them covers.
 *
 * Positions are fixed: row i column j is only ever compared with row i column j, so the count of
 * differing cells is both the minimum number of single-cell edits between the two matrices and
 * something a student can verify by counting.
 *
 * Throws when the key has a blank cell inside its own frame. Such a key is unanswerable — the
 * answer UI forbids submitting a blank inside the frame — so failing loudly beats grading everyone
 * against a matrix nobody can reproduce.
 */
export const compareMatrices = (
  studentMatrix: readonly (readonly string[])[] | null | undefined,
  keyMatrix: readonly (readonly string[])[] | null | undefined,
  tolerance: number,
): MatrixDifference => {
  const keyShape = matrixShape(keyMatrix)

  // The student answer is attacker-controlled and reaches this endpoint directly, not just
  // through the 6x6 answer UI; without this, an oversized answer turns matrixShape's scan and the
  // comparison loop below into an unbounded Cartesian product.
  if (
    (studentMatrix?.length ?? 0) > MATRIX_GRID_SIZE ||
    studentMatrix?.some((row) => (row?.length ?? 0) > MATRIX_GRID_SIZE)
  ) {
    throw new Error(`Matrix answer exceeds the ${MATRIX_GRID_SIZE}x${MATRIX_GRID_SIZE} grid`)
  }
  const studentShape = matrixShape(studentMatrix)

  const holes = blankCellsInsideShape(keyMatrix, keyShape)
  if (holes.length > 0) {
    const positions = holes.map(({ row, column }) => `(${row + 1},${column + 1})`).join(", ")
    throw new Error(
      `Matrix item has blank cells inside the correct answer at ${positions}. ` +
        "A student cannot submit a blank there, so the item is unanswerable.",
    )
  }

  const cellFeedbacks: MatrixCellFeedback[] = []
  let correctCells = 0
  let incorrectCells = 0
  let missingCells = 0
  let extraCells = 0

  const rows = Math.max(keyShape.rows, studentShape.rows)
  const columns = Math.max(keyShape.columns, studentShape.columns)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const inKey = row < keyShape.rows && column < keyShape.columns
      const inStudentAnswer = row < studentShape.rows && column < studentShape.columns
      if (!inKey && !inStudentAnswer) {
        continue
      }
      if (inKey && !inStudentAnswer) {
        missingCells++
        cellFeedbacks.push({ row, column, verdict: "missing" })
        continue
      }
      if (!inKey && inStudentAnswer) {
        extraCells++
        cellFeedbacks.push({ row, column, verdict: "extra" })
        continue
      }
      const studentCell = studentMatrix?.[row]?.[column] ?? ""
      const keyCell = keyMatrix?.[row]?.[column] ?? ""
      // A gap punched into an answer by a non-UI client claims the position without filling it.
      const matches = !isBlankCell(studentCell) && cellsMatch(studentCell, keyCell, tolerance)
      if (matches) {
        correctCells++
        cellFeedbacks.push({ row, column, verdict: "correct" })
      } else {
        incorrectCells++
        cellFeedbacks.push({ row, column, verdict: "incorrect" })
      }
    }
  }

  return {
    cellFeedbacks,
    breakdown: {
      correctCells,
      incorrectCells,
      missingCells,
      extraCells,
      keyCells: keyShape.rows * keyShape.columns,
    },
    differingCells: incorrectCells + missingCells + extraCells,
    shapesMatch: keyShape.rows === studentShape.rows && keyShape.columns === studentShape.columns,
    studentShape,
    keyShape,
  }
}
