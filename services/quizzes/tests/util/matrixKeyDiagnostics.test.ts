import { matrixKeyDiagnostics } from "../../src/util/matrixKeyDiagnostics"

describe("matrix key diagnostics", () => {
  test("reports what an all-zero answer would score, which is the case for using all-or-nothing", () => {
    const identity = [
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ]
    expect(matrixKeyDiagnostics(identity).zeroMatrixScore).toBeCloseTo(6 / 9)
  })

  test("reports nothing to worry about when no entry is zero", () => {
    expect(
      matrixKeyDiagnostics([
        ["1", "2"],
        ["3", "4"],
      ]).zeroMatrixScore,
    ).toBe(0)
  })

  test("finds the cells the teacher left empty inside the answer", () => {
    expect(
      matrixKeyDiagnostics([
        ["1", ""],
        ["", "4"],
      ]).gaps,
    ).toEqual([
      { row: 0, column: 1 },
      { row: 1, column: 0 },
    ])
  })

  test("caps the tolerance below half the closest pair of values", () => {
    expect(
      matrixKeyDiagnostics([
        ["0", "1"],
        ["2", "3"],
      ]).largestSafeTolerance,
    ).toBe(0.5)
  })

  test("caps the tolerance below half the smallest entry, so zero stays distinguishable", () => {
    expect(
      matrixKeyDiagnostics([
        ["0", "0.5"],
        ["10", "20"],
      ]).largestSafeTolerance,
    ).toBe(0.25)
  })

  test("has nothing to cap when the key holds no numbers", () => {
    expect(matrixKeyDiagnostics([["x", "y"]]).largestSafeTolerance).toBeNull()
  })

  test("points at cells whose comma will be read as a decimal point", () => {
    expect(matrixKeyDiagnostics([["1,234", "0,333"]]).commaAsThousandsSeparator).toEqual([
      { row: 0, column: 0 },
    ])
  })

  test("points at numbers nothing can read", () => {
    expect(matrixKeyDiagnostics([["1,234,567", "2"]]).malformedNumbers).toEqual([
      { row: 0, column: 0 },
    ])
  })
})
