/** What counts as a blank cell, a number and a match; shared by the UI and the grader so their frames agree. */

/** Dashes a keyboard, a phone or a word processor may produce where the student meant a minus. */
const DASH_CHARACTERS = /[‐‑‒–—−－]/g

/** Optional sign, then digits with one optional decimal separator. `- 1` is a number, `1 000` is not. */
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

/** Normalizes Unicode composition and dashes and trims; inner whitespace is left to `cellsMatch`. */
export const normalizeCell = (raw: string): string =>
  raw.normalize("NFC").replaceAll(DASH_CHARACTERS, "-").trim()

/** Non-strings count as blank: stored answers are client-supplied and may hold null or numbers. */
export const isBlankCell = (raw: unknown): boolean =>
  typeof raw !== "string" || normalizeCell(raw) === ""

/** The cell's numeric value, or null. Unlike `Number()`, rejects exponents, hex and `Infinity`. */
export const parseCellNumber = (raw: string): number | null => {
  const normalized = normalizeCell(raw)
  if (!NUMERIC_CELL.test(normalized)) {
    return null
  }
  const value = Number(normalized.replaceAll(/\s+/g, "").replace(",", "."))
  return Number.isFinite(value) ? value : null
}

/** Whether the student wrote a number no rule can rescue, e.g. `1,234,567` or `1 000`. */
export const isMalformedNumberCell = (raw: string): boolean => {
  const normalized = normalizeCell(raw)
  if (normalized === "" || !NUMBER_LIKE.test(normalized)) {
    return false
  }
  return parseCellNumber(raw) === null
}

/** Whether to warn that a comma here will be read as a decimal point rather than a grouping mark. */
export const looksLikeThousandsSeparator = (raw: string): boolean =>
  COMMA_AS_THOUSANDS_SEPARATOR.test(normalizeCell(raw))

/**
 * Numbers match within `tolerance`; other cells match as case-sensitive text ignoring whitespace.
 * A number never matches a non-number.
 */
export const cellsMatch = (a: string, b: string, tolerance: number): boolean => {
  const numberA = parseCellNumber(a)
  const numberB = parseCellNumber(b)
  if (numberA !== null && numberB !== null) {
    // A negative tolerance would reject even exact matches
    return Math.abs(numberA - numberB) <= Math.max(tolerance, 0)
  }
  if ((numberA === null) !== (numberB === null)) {
    return false
  }
  return normalizeCell(a).replaceAll(/\s+/g, "") === normalizeCell(b).replaceAll(/\s+/g, "")
}

/** The top-left-anchored bounding box of the non-blank cells: the frame the UI draws and the grader uses. */
export const matrixShape = (
  matrix: readonly (readonly unknown[])[] | null | undefined,
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
  matrix: readonly (readonly unknown[])[] | null | undefined,
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

/** A completely filled rectangle anchored at the top-left, the only shape a student can submit. */
export const isFilledRectangle = (matrix: readonly (readonly unknown[])[] | null | undefined) => {
  const shape = matrixShape(matrix)
  return shape.rows > 0 && blankCellsInsideShape(matrix, shape).length === 0
}

/** A blank grid of the size both editors render. */
export const emptyMatrixGrid = (): string[][] =>
  Array.from({ length: MATRIX_GRID_SIZE }, () => Array.from({ length: MATRIX_GRID_SIZE }, () => ""))
