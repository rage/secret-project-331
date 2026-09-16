/**
 * Shared meaning of a matrix cell: what counts as blank, what counts as a number, and how two
 * cells compare. The answer UI, the editor and the grader all import from here, because a frame
 * the student sees and a frame the grader computes must never disagree.
 */

/** Dashes a keyboard, a phone or a word processor may produce where the student meant a minus. */
const DASH_CHARACTERS = /[‐‑‒–—−－]/g

/**
 * Sign, then digits with at most one decimal separator, digits on at least one side. Whitespace is
 * tolerated only between the sign and the digits, so `- 1` is a number while `1 000` is not: a
 * space must not become a thousands separator when `1,234` is deliberately read as 1.234.
 */
const NUMERIC_CELL = /^[+-]?\s*(?:\d+(?:[.,]\d*)?|[.,]\d+)$/

/** A comma that reads as a thousands separator: a nonzero integer part and exactly three decimals. */
const COMMA_AS_THOUSANDS_SEPARATOR = /^[+-]?\s*[1-9]\d{0,2},\d{3}$/

/** Digits, separators, signs and whitespace only, so `f(a,b)` is never mistaken for a number. */
const NUMBER_LIKE = /^[+-\s.,\d]*\d[+-\s.,\d]*$/

/** The grid is a fixed 6x6 of text inputs in both the answer UI and the editor. */
export const MATRIX_GRID_SIZE = 6

/** Dimensions in cells, not indices. */
export interface MatrixShape {
  rows: number
  columns: number
}

/**
 * Fold away differences that carry no mathematical meaning: composed characters, the dash family,
 * and surrounding whitespace. Does not remove inner whitespace, which `cellsMatch` handles per branch.
 */
export const normalizeCell = (raw: string): string =>
  raw.normalize("NFC").replaceAll(DASH_CHARACTERS, "-").trim()

export const isBlankCell = (raw: string | undefined): boolean =>
  raw === undefined || normalizeCell(raw) === ""

/**
 * The value of a numeric cell, or null when the cell is symbolic, malformed or blank. Rejects
 * everything `Number()` would quietly accept but a hand-typed matrix entry never means: scientific
 * notation, hexadecimal, and `Infinity`.
 */
export const parseCellNumber = (raw: string): number | null => {
  const normalized = normalizeCell(raw)
  if (!NUMERIC_CELL.test(normalized)) {
    return null
  }
  const value = Number(normalized.replaceAll(/\s+/g, "").replace(",", "."))
  return Number.isFinite(value) ? value : null
}

/** Whether the student wrote a number no rule can rescue, e.g. `1,234,567` or `1.2.3`. */
export const isMalformedNumberCell = (raw: string): boolean => {
  const normalized = normalizeCell(raw)
  if (normalized === "" || !NUMBER_LIKE.test(normalized)) {
    return false
  }
  const separators = normalized.match(/[.,]/g)?.length ?? 0
  return separators >= 2
}

/** Whether to warn that a comma here will be read as a decimal point rather than a grouping mark. */
export const looksLikeThousandsSeparator = (raw: string): boolean =>
  COMMA_AS_THOUSANDS_SEPARATOR.test(normalizeCell(raw))

/**
 * Whether two cells hold the same entry. Numeric cells compare by value within `tolerance`;
 * anything else compares as text with inner whitespace removed (`- 1` and `-1`, `2 x` and `2x`)
 * and case preserved, since `x` and `X` are different variables.
 */
export const cellsMatch = (a: string, b: string, tolerance: number): boolean => {
  const numberA = parseCellNumber(a)
  const numberB = parseCellNumber(b)
  if (numberA !== null && numberB !== null) {
    return Math.abs(numberA - numberB) <= tolerance
  }
  return normalizeCell(a).replaceAll(/\s+/g, "") === normalizeCell(b).replaceAll(/\s+/g, "")
}

/**
 * The rectangle anchored at the top-left that contains every non-blank cell — the frame the UI
 * draws while the student types, so the shape they see is the shape they are graded on.
 */
export const matrixShape = (
  matrix: readonly (readonly string[])[] | null | undefined,
): MatrixShape => {
  let rows = 0
  let columns = 0
  matrix?.forEach((row, rowIndex) => {
    row?.forEach((cell, columnIndex) => {
      if (isBlankCell(cell)) {
        return
      }
      rows = Math.max(rows, rowIndex + 1)
      columns = Math.max(columns, columnIndex + 1)
    })
  })
  return { rows, columns }
}

/** Positions inside the shape that the author left blank; a student can never reproduce these. */
export const blankCellsInsideShape = (
  matrix: readonly (readonly string[])[] | null | undefined,
  shape: MatrixShape,
): { row: number; column: number }[] => {
  const holes: { row: number; column: number }[] = []
  for (let row = 0; row < shape.rows; row++) {
    for (let column = 0; column < shape.columns; column++) {
      if (isBlankCell(matrix?.[row]?.[column])) {
        holes.push({ row, column })
      }
    }
  }
  return holes
}

/** A blank grid of the size both editors render, used when a key has to be reset to something well-formed. */
export const emptyMatrixGrid = (): string[][] =>
  Array.from({ length: MATRIX_GRID_SIZE }, () => Array.from({ length: MATRIX_GRID_SIZE }, () => ""))
