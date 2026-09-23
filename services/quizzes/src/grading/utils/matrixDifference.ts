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
  // The student answer is attacker-controlled and reaches this endpoint directly, not just through
  // the 6x6 answer UI. The key is admin-controlled but nothing upstream bounds it either (migration
  // only pads a key up to size, never shrinks one down). Without this, either side can turn
  // matrixShape's scan and the comparison loop below into an unbounded Cartesian product.
  if (isOversized(studentMatrix)) {
    throw new Error(`Matrix answer exceeds the ${MATRIX_GRID_SIZE}x${MATRIX_GRID_SIZE} grid`)
  }
  if (isOversized(keyMatrix)) {
    throw new Error(`Matrix key exceeds the ${MATRIX_GRID_SIZE}x${MATRIX_GRID_SIZE} grid`)
  }

  const keyShape = matrixShape(keyMatrix)
  // An empty key defines no correct answer, which the editor blocks saving; a key that reaches
  // grading in this state is a data bug worth surfacing rather than silently scoring everyone 0.
  if (keyShape.rows === 0 || keyShape.columns === 0) {
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
        // studentShape is the bounding box of the student's non-blank cells, not a filled
        // rectangle: a position inside it can still be blank (e.g. a stray cell far from the
        // rest of the answer widens the box without filling it), and a blank cell is not "extra".
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
