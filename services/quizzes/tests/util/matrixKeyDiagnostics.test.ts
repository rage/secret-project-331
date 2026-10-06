import { matrixKeyDiagnostics } from "../../src/util/matrixKeyDiagnostics"

describe("matrix key diagnostics", () => {
  test("reports what an all-zero answer would score, which is the case for using all-or-nothing", () => {
    const identity = [
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ]
    expect(matrixKeyDiagnostics(identity, 0).zeroMatrixScore).toBeCloseTo(6 / 9)
  })

  test("reports nothing to worry about when no entry is zero", () => {
    expect(
      matrixKeyDiagnostics(
        [
          ["1", "2"],
          ["3", "4"],
        ],
        0,
      ).zeroMatrixScore,
    ).toBe(0)
  })

  test("counts a cell a zero answer would also match under the configured tolerance", () => {
    // Grading accepts "0" for a "0.1" cell once tolerance reaches 0.2, so a zero answer's score
    // must count that cell too, not just the exact zeros.
    expect(
      matrixKeyDiagnostics(
        [
          ["0.1", "5"],
          ["10", "20"],
        ],
        0.2,
      ).zeroMatrixScore,
    ).toBeCloseTo(1 / 4)
  })

  test("finds the cells the teacher left empty inside the answer", () => {
    expect(
      matrixKeyDiagnostics(
        [
          ["1", ""],
          ["", "4"],
        ],
        0,
      ).gaps,
    ).toEqual([
      { row: 0, column: 1 },
      { row: 1, column: 0 },
    ])
  })

  test("caps the tolerance strictly below half the closest pair of values", () => {
    const limit = matrixKeyDiagnostics(
      [
        ["0", "1"],
        ["2", "3"],
      ],
      0,
    ).largestSafeTolerance
    expect(limit).toBeLessThan(0.5)
    expect(limit).toBeCloseTo(0.5)
  })

  test("caps the tolerance strictly below half the smallest entry, so zero stays distinguishable", () => {
    const limit = matrixKeyDiagnostics(
      [
        ["0", "0.5"],
        ["10", "20"],
      ],
      0,
    ).largestSafeTolerance
    expect(limit).toBeLessThan(0.25)
    expect(limit).toBeCloseTo(0.25)
  })

  test("the exact naive midpoint tolerance is rejected as unsafe, since it would match both values", () => {
    const limit = matrixKeyDiagnostics(
      [
        ["1", "2"],
        ["0", "0"],
      ],
      0,
    ).largestSafeTolerance
    expect(limit).not.toBeNull()
    // At the naive midpoint (0.5), a value of 1.5 would satisfy `<= tolerance` against both 1 and 2.
    expect(Math.abs(1 - 1.5) <= (limit ?? 0)).toBe(false)
    expect(Math.abs(2 - 1.5) <= (limit ?? 0)).toBe(false)
  })

  test("has nothing to cap when the key holds no numbers", () => {
    expect(matrixKeyDiagnostics([["x", "y"]], 0).largestSafeTolerance).toBeNull()
  })

  test("never goes negative, even for magnitudes far smaller than the epsilon floor", () => {
    const limit = matrixKeyDiagnostics([["0.0000000000000001", "0"]], 0).largestSafeTolerance
    expect(limit).not.toBeNull()
    expect(limit).toBeGreaterThanOrEqual(0)
  })

  test("points at cells whose comma will be read as a decimal point", () => {
    expect(matrixKeyDiagnostics([["1,234", "0,333"]], 0).commaAsThousandsSeparator).toEqual([
      { row: 0, column: 0 },
    ])
  })

  test("points at numbers nothing can read", () => {
    expect(matrixKeyDiagnostics([["1,234,567", "2"]], 0).malformedNumbers).toEqual([
      { row: 0, column: 0 },
    ])
  })
})
