import {
  cellsMatch,
  isBlankCell,
  isMalformedNumberCell,
  looksLikeThousandsSeparator,
  matrixShape,
  parseCellNumber,
} from "../../src/util/matrix"

describe("matrix cell numbers", () => {
  test.each([
    ["3", 3],
    ["-3", -3],
    ["+3", 3],
    ["- 1", -1],
    [".5", 0.5],
    ["5.", 5],
    ["0,5", 0.5],
    [",5", 0.5],
    ["2.0", 2],
    ["-0", -0],
    ["1,234", 1.234],
  ])("reads %s as %s", (text, expected) => {
    expect(parseCellNumber(text)).toBe(expected)
  })

  test.each(["1e3", "0x1f", "Infinity", "1/2", "1,234,567", "1.2.3", "1 000", "x", "", "."])(
    "refuses to read %s as a number",
    (text) => {
      expect(parseCellNumber(text)).toBeNull()
    },
  )

  test("a thousands-grouping space is never a number, so a space cannot become a separator", () => {
    expect(parseCellNumber("1 000")).toBeNull()
    expect(parseCellNumber("1,000")).toBe(1)
  })

  test("reads a typographic minus and other dashes as a sign", () => {
    expect(parseCellNumber("−1")).toBe(-1)
    expect(parseCellNumber("–1")).toBe(-1)
  })
})

describe("matrix cell comparison", () => {
  test("numbers compare by value, not by spelling", () => {
    expect(cellsMatch("2", "2.0", 0)).toBe(true)
    expect(cellsMatch("0,5", ".5", 0)).toBe(true)
    expect(cellsMatch("-0", "0", 0)).toBe(true)
  })

  test("tolerance is absolute, and the boundary itself is accepted", () => {
    // Binary-exact values: an inclusive `<=` on a distance like 0.33 - 0.3 would land just outside.
    expect(cellsMatch("0.5", "0.25", 0.25)).toBe(true)
    expect(cellsMatch("0.5", "0.25", 0.2)).toBe(false)
  })

  test("a zero tolerance demands the same value", () => {
    expect(cellsMatch("0.5", "0.5", 0)).toBe(true)
    expect(cellsMatch("0.5", "0.51", 0)).toBe(false)
  })

  test("a fraction is text, so tolerance cannot rescue it", () => {
    expect(cellsMatch("1/2", "0.5", 0.5)).toBe(false)
    expect(cellsMatch("1/2", "1/2", 0)).toBe(true)
  })

  test("text ignores inner whitespace but not case, since x and X are different variables", () => {
    expect(cellsMatch("2 x", "2x", 0)).toBe(true)
    expect(cellsMatch("- x", "-x", 0)).toBe(true)
    expect(cellsMatch("x", "X", 0)).toBe(false)
  })

  test("a number never matches text that merely looks similar", () => {
    expect(cellsMatch("2", "two", 0)).toBe(false)
  })
})

describe("matrix shape", () => {
  test("is the rectangle anchored at the top-left that holds every non-blank cell", () => {
    expect(
      matrixShape([
        ["1", "2", ""],
        ["3", "4", ""],
        ["", "", ""],
      ]),
    ).toEqual({
      rows: 2,
      columns: 2,
    })
  })

  test("a cell holding only whitespace is blank, so it never enlarges the frame", () => {
    expect(isBlankCell("   ")).toBe(true)
    expect(
      matrixShape([
        ["1", " "],
        ["", ""],
      ]),
    ).toEqual({ rows: 1, columns: 1 })
  })

  test("an empty grid has no shape at all", () => {
    expect(
      matrixShape([
        ["", ""],
        ["", ""],
      ]),
    ).toEqual({ rows: 0, columns: 0 })
    expect(matrixShape(null)).toEqual({ rows: 0, columns: 0 })
  })

  test("a cell far from the origin stretches the frame over the gap", () => {
    expect(
      matrixShape([
        ["1", ""],
        ["", "4"],
      ]),
    ).toEqual({ rows: 2, columns: 2 })
  })
})

describe("matrix cell warnings", () => {
  test("flags a comma that reads as a thousands separator", () => {
    expect(looksLikeThousandsSeparator("1,234")).toBe(true)
    expect(looksLikeThousandsSeparator("12,345")).toBe(true)
  })

  test("stays quiet on three-decimal answers, which is what a comma usually means here", () => {
    expect(looksLikeThousandsSeparator("0,333")).toBe(false)
    expect(looksLikeThousandsSeparator("0,125")).toBe(false)
    expect(looksLikeThousandsSeparator("1,23")).toBe(false)
  })

  test("flags a number with two separators, and leaves symbolic cells alone", () => {
    expect(isMalformedNumberCell("1,234,567")).toBe(true)
    expect(isMalformedNumberCell("1.2.3")).toBe(true)
    expect(isMalformedNumberCell("f(a,b,c)")).toBe(false)
    expect(isMalformedNumberCell("1,234")).toBe(false)
  })
})
