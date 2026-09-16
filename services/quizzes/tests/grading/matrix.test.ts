import { assessMatrixQuiz } from "../../src/grading/assessment/matrix"
import type { UserItemAnswerMatrix } from "../../types/quizTypes/answer"
import type {
  MatrixGradingPolicy,
  PrivateSpecQuizItemMatrix,
} from "../../types/quizTypes/privateSpec"

const KEY_3X3 = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
]

const matrixItem = (
  overrides: Partial<PrivateSpecQuizItemMatrix> = {},
): PrivateSpecQuizItemMatrix => ({
  type: "matrix",
  id: "matrix-item",
  order: 0,
  title: null,
  optionCells: KEY_3X3,
  feedbackMessages: [],
  gradingPolicy: "whole-matrix",
  tolerance: 0,
  partialCreditForWrongShape: false,
  fogOfWar: false,
  ...overrides,
})

const answer = (matrix: string[][]): UserItemAnswerMatrix => ({
  type: "matrix",
  valid: true,
  quizItemId: "matrix-item",
  matrix,
})

const score = (matrix: string[][], overrides: Partial<PrivateSpecQuizItemMatrix> = {}): number =>
  assessMatrixQuiz(answer(matrix), matrixItem(overrides)).correctnessCoefficient

const perCell = (partialCreditForWrongShape: boolean): Partial<PrivateSpecQuizItemMatrix> => ({
  gradingPolicy: "per-cell" satisfies MatrixGradingPolicy,
  partialCreditForWrongShape,
})

describe("matrix grading: whole-matrix", () => {
  test("awards everything only when nothing differs", () => {
    expect(score(KEY_3X3)).toBe(1)
  })

  test("one wrong entry loses everything", () => {
    expect(
      score([
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "0"],
      ]),
    ).toBe(0)
  })

  test("the right entries in the wrong size lose everything", () => {
    expect(
      score([
        ["1", "2"],
        ["4", "5"],
      ]),
    ).toBe(0)
  })

  test("numbers are compared by value, so a rewritten key still matches", () => {
    expect(
      score([
        ["1.0", "2", "+3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
      ]),
    ).toBe(1)
  })

  test("the wrong-shape switch does nothing here, since a size difference already differs", () => {
    expect(
      score(
        [
          ["1", "2"],
          ["4", "5"],
        ],
        { partialCreditForWrongShape: true },
      ),
    ).toBe(0)
  })
})

describe("matrix grading: per-cell with the right size", () => {
  test("charges one entry's share per wrong entry", () => {
    expect(
      score(
        [
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "0"],
        ],
        perCell(false),
      ),
    ).toBeCloseTo(8 / 9)
  })

  test("a wrong size scores nothing while the switch is off", () => {
    expect(
      score(
        [
          ["1", "2"],
          ["4", "5"],
        ],
        perCell(false),
      ),
    ).toBe(0)
  })
})

describe("matrix grading: per-cell with credit for a wrong size", () => {
  // Every case charges one share per wrong, missing and extra entry against the key's nine cells.
  test.each([
    [
      "one row short",
      [
        ["1", "2", "3"],
        ["4", "5", "6"],
      ],
      6 / 9,
    ],
    [
      "one column too many",
      [
        ["1", "2", "3", "x"],
        ["4", "5", "6", "x"],
        ["7", "8", "9", "x"],
      ],
      6 / 9,
    ],
    [
      "two by two",
      [
        ["1", "2"],
        ["4", "5"],
      ],
      4 / 9,
    ],
    [
      "the right matrix padded out to four by four",
      [
        ["1", "2", "3", "0"],
        ["4", "5", "6", "0"],
        ["7", "8", "9", "0"],
        ["0", "0", "0", "0"],
      ],
      2 / 9,
    ],
    ["only the top-left entry", [["1"]], 1 / 9],
    [
      "nothing at all",
      [
        ["", ""],
        ["", ""],
      ],
      0,
    ],
  ])("%s scores %d", (_name, matrix, expected) => {
    expect(score(matrix, perCell(true))).toBeCloseTo(expected)
  })

  test("fewer mistakes always scores higher, whichever kind they are", () => {
    const twoByTwo = score(
      [
        ["1", "2"],
        ["4", "5"],
      ],
      perCell(true),
    )
    const fourByFour = score(
      [
        ["1", "2", "3", "0"],
        ["4", "5", "6", "0"],
        ["7", "8", "9", "0"],
        ["0", "0", "0", "0"],
      ],
      perCell(true),
    )
    expect(twoByTwo).toBeGreaterThan(fourByFour)
  })

  test("a transposed non-square answer is a different matrix, not a nearly-right one", () => {
    const key = [
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]
    expect(
      score(
        [
          ["1", "3", "5"],
          ["2", "4", "6"],
        ],
        { ...perCell(true), optionCells: key },
      ),
    ).toBe(0)
  })
})

describe("matrix grading: tolerance", () => {
  test("accepts a number within the tolerance and refuses one outside it", () => {
    const key = [["0.5"]]
    expect(score([["0.25"]], { optionCells: key, tolerance: 0.25 })).toBe(1)
    expect(score([["0.25"]], { optionCells: key, tolerance: 0.2 })).toBe(0)
  })

  test("never reaches a fraction, which is compared as text", () => {
    expect(score([["0.5"]], { optionCells: [["1/2"]], tolerance: 0.5 })).toBe(0)
    expect(score([["1/2"]], { optionCells: [["1/2"]], tolerance: 0 })).toBe(1)
  })
})

describe("matrix grading: keys and answers that should not exist", () => {
  test("refuses a key with a gap, which no student could ever reproduce", () => {
    const gappedKey = [
      ["1", ""],
      ["", "4"],
    ]
    expect(() =>
      score(
        [
          ["1", "2"],
          ["3", "4"],
        ],
        { optionCells: gappedKey },
      ),
    ).toThrow(/blank cells inside the correct answer/)
  })

  test("an empty key defines no correct answer, so nothing matches it", () => {
    expect(score([["1"]], { optionCells: null })).toBe(0)
    expect(score([["1"]], { optionCells: [["", ""]], gradingPolicy: "per-cell" })).toBe(0)
  })

  test("a gap punched into an answer by a non-UI client is a wrong entry, not a free pass", () => {
    expect(
      score(
        [
          ["1", ""],
          ["", "4"],
        ],
        {
          optionCells: [
            ["1", "2"],
            ["3", "4"],
          ],
        },
      ),
    ).toBe(0)
    expect(
      score(
        [
          ["1", ""],
          ["", "4"],
        ],
        {
          optionCells: [
            ["1", "2"],
            ["3", "4"],
          ],
          ...perCell(false),
        },
      ),
    ).toBeCloseTo(2 / 4)
  })
})
