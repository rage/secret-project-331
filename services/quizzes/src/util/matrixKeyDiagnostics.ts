/**
 * Problems a teacher can create in a matrix key that only surface when a student answers.
 *
 * Nothing here blocks saving; the editor shows these so the teacher can fix the key before anyone
 * is graded against it. The one exception is a key with gaps, which the grader refuses outright.
 */
import {
  isBlankCell,
  isMalformedNumberCell,
  looksLikeThousandsSeparator,
  matrixShape,
  parseCellNumber,
} from "./matrix"

export interface MatrixCellPosition {
  row: number
  column: number
}

export interface MatrixKeyDiagnostics {
  /** Cells left empty inside the key's own frame. A student cannot submit a gap, so the item is unanswerable. */
  gaps: MatrixCellPosition[]
  /** Cells whose comma reads as a thousands separator but will be graded as a decimal point. */
  commaAsThousandsSeparator: MatrixCellPosition[]
  /** Cells that look like a number but cannot be read as one, so they only ever match the same text. */
  malformedNumbers: MatrixCellPosition[]
  /**
   * What an answer of all zeros would score under per-cell grading, as a fraction of the points.
   * High on sparse keys (an identity, a diagonal) where most entries are predictable, which is the
   * signal that all-or-nothing is the better policy. Null when the key has no cells.
   */
  zeroMatrixScore: number | null
  /**
   * The largest tolerance that still tells every distinct value in the key apart and keeps zero
   * distinguishable from the smallest nonzero entry. Null when the key holds no numbers.
   */
  largestSafeTolerance: number | null
}

export const matrixKeyDiagnostics = (
  optionCells: readonly (readonly string[])[] | null | undefined,
  tolerance: number,
): MatrixKeyDiagnostics => {
  const shape = matrixShape(optionCells)
  const gaps: MatrixCellPosition[] = []
  const commaAsThousandsSeparator: MatrixCellPosition[] = []
  const malformedNumbers: MatrixCellPosition[] = []
  const numericValues: number[] = []
  let zeroCells = 0

  for (let row = 0; row < shape.rows; row++) {
    for (let column = 0; column < shape.columns; column++) {
      const cell = optionCells?.[row]?.[column] ?? ""
      if (isBlankCell(cell)) {
        gaps.push({ row, column })
        continue
      }
      if (looksLikeThousandsSeparator(cell)) {
        commaAsThousandsSeparator.push({ row, column })
      }
      if (isMalformedNumberCell(cell)) {
        malformedNumbers.push({ row, column })
      }
      const value = parseCellNumber(cell)
      if (value !== null) {
        numericValues.push(value)
        if (Math.abs(value) <= tolerance) {
          zeroCells++
        }
      }
    }
  }

  const keyCells = shape.rows * shape.columns
  return {
    gaps,
    commaAsThousandsSeparator,
    malformedNumbers,
    zeroMatrixScore: keyCells === 0 ? null : zeroCells / keyCells,
    largestSafeTolerance: largestSafeTolerance(numericValues),
  }
}

/**
 * Strictly below half the smallest distance between any two distinct values in the key, and below
 * half the smallest nonzero magnitude. At exactly half, `cellsMatch`'s inclusive `<=` accepts both
 * neighboring values (and zero in place of a nonzero entry), so the limit itself is not safe.
 */
const largestSafeTolerance = (values: number[]): number | null => {
  if (values.length === 0) {
    return null
  }
  const distinct = [...new Set(values)].toSorted((a, b) => a - b)
  let smallestGap = Number.POSITIVE_INFINITY
  for (let i = 1; i < distinct.length; i++) {
    smallestGap = Math.min(smallestGap, (distinct[i] ?? 0) - (distinct[i - 1] ?? 0))
  }
  const smallestNonzeroMagnitude = Math.min(
    ...distinct.filter((value) => value !== 0).map((value) => Math.abs(value)),
    Number.POSITIVE_INFINITY,
  )
  const limit = Math.min(smallestGap, smallestNonzeroMagnitude)
  if (!Number.isFinite(limit)) {
    return null
  }
  const halfLimit = limit / 2
  // The epsilon floor must itself stay below halfLimit, or subtracting it would push the result
  // negative for a key holding extremely small magnitudes (e.g. ~1e-16).
  return halfLimit - Math.min(Math.max(halfLimit * 1e-9, Number.EPSILON), halfLimit)
}
