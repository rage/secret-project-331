/** Matrix key problems the editor warns about. Only gaps also block saving. */
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
  /** The per-cell score of an all-zeros answer; high on sparse keys. Null when the key is empty. */
  zeroMatrixScore: number | null
  /** The largest tolerance that keeps every key value, and zero, distinct. Null without numbers. */
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
        // Same clamp as cellsMatch, so a negative tolerance still counts exact zeros
        if (Math.abs(value) <= Math.max(tolerance, 0)) {
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

/** Just under half the smallest gap between values (zero included): `cellsMatch`'s `<=` makes exactly half unsafe. */
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
