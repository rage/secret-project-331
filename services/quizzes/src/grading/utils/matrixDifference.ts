import {
  blankCellsInsideShape,
  cellsMatch,
  isBlankCell,
  MATRIX_GRID_SIZE,
  matrixShape,
} from "@/util/matrix"

import type { MatrixCellFeedback, MatrixDifference } from "../../../types/quizTypes/grading"

const isOversized = (matrix: readonly (readonly string[])[] | null | undefined): boolean =>
  (matrix?.length ?? 0) > MATRIX_GRID_SIZE ||
  (matrix?.some((row) => (row?.length ?? 0) > MATRIX_GRID_SIZE) ?? false)

/**
 * Compares the matrices position by position over the cells either covers. Throws on an oversized
 * matrix or a key that is empty or has a gap, since no student can reproduce such a key.
 */
export const compareMatrices = (
  studentMatrix: readonly (readonly string[])[] | null | undefined,
  keyMatrix: readonly (readonly string[])[] | null | undefined,
  tolerance: number,
): MatrixDifference => {
  // Answers can bypass the 6x6 UI; bounding both sides keeps the scan below cheap.
  if (isOversized(studentMatrix)) {
    throw new Error(`Matrix answer exceeds the ${MATRIX_GRID_SIZE}x${MATRIX_GRID_SIZE} grid`)
  }
  if (isOversized(keyMatrix)) {
    throw new Error(`Matrix key exceeds the ${MATRIX_GRID_SIZE}x${MATRIX_GRID_SIZE} grid`)
  }

  const keyShape = matrixShape(keyMatrix)
  if (keyShape.rows === 0) {
    throw new Error("Matrix item has no correct answer configured")
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
        // The student's shape is a bounding box, so a position inside it can still be blank.
        if (isBlankCell(studentMatrix?.[row]?.[column])) {
          continue
        }
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
  }
}
