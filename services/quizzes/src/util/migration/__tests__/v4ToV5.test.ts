import type { UserItemAnswerMatrix } from "../../../../types/quizTypes/answer"
import type { PrivateSpecQuizItemMatrix } from "../../../../types/quizTypes/privateSpec"
import type { PrivateSpecQuizItemMatrixV4, PrivateSpecQuizV4 } from "../../../../types/quizTypes/v4"
import { assessMatrixQuiz } from "../../../grading/assessment/matrix"
import { migratePrivateSpecV4ToV5 } from "../v4ToV5"

const v4Matrix = (
  overrides: Partial<PrivateSpecQuizItemMatrixV4> = {},
): PrivateSpecQuizItemMatrixV4 => ({
  type: "matrix",
  id: "matrix-item",
  order: 0,
  title: null,
  optionCells: [
    ["1", "2"],
    ["3", "4"],
  ],
  feedbackMessages: [],
  ...overrides,
})

const v4Quiz = (item: PrivateSpecQuizItemMatrixV4): PrivateSpecQuizV4 => ({
  version: "4",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  title: null,
  body: null,
  quizItemDisplayDirection: "vertical",
  feedbackMessages: [],
  items: [item],
})

const migrateMatrixItem = (
  overrides: Partial<PrivateSpecQuizItemMatrixV4> = {},
): PrivateSpecQuizItemMatrix =>
  migratePrivateSpecV4ToV5(v4Quiz(v4Matrix(overrides))).items[0] as PrivateSpecQuizItemMatrix

/** The v4 grader: every cell of the fixed grid had to be the same string. */
const gradedCorrectlyUnderV4 = (answer: string[][], key: string[][]): boolean => {
  for (let row = 0; row < 6; row++) {
    for (let column = 0; column < 6; column++) {
      if ((key[row]?.[column] ?? undefined) !== (answer[row]?.[column] ?? undefined)) {
        return false
      }
    }
  }
  return true
}

describe("v4 -> v5 matrix migration", () => {
  test("puts every existing item on all-or-nothing with no tolerance", () => {
    expect(migrateMatrixItem()).toMatchObject({
      gradingPolicy: "whole-matrix",
      tolerance: 0,
      partialCreditForWrongShape: false,
      fogOfWar: false,
    })
  })

  test("empties cells that held only whitespace, so the grader sees the editor's frame", () => {
    const migrated = migrateMatrixItem({
      optionCells: [
        ["1", "  "],
        ["\t", "4"],
      ],
    })
    expect(migrated.optionCells?.[0]?.[1]).toBe("")
    expect(migrated.optionCells?.[1]?.[0]).toBe("")
  })

  test("turns a key that was never filled in into a well-formed empty grid", () => {
    expect(migrateMatrixItem({ optionCells: null }).optionCells).toEqual(
      Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => "")),
    )
  })

  test("leaves the teacher's own text alone", () => {
    expect(migrateMatrixItem().optionCells?.[0]?.[0]).toBe("1")
  })

  test("pads every row to the same column count, so a ragged legacy matrix migrates to a rectangle", () => {
    const migrated = migrateMatrixItem({
      optionCells: [["1", "2", "3", "4", "5", "6", "7", "8"], ["9"]],
    })
    const columnCounts = new Set(migrated.optionCells?.map((row) => row.length))
    expect(columnCounts.size).toBe(1)
    expect(migrated.optionCells?.[0]).toHaveLength(8)
    expect(migrated.optionCells?.[1]).toHaveLength(8)
  })
})

describe("v4 -> v5 migration never lowers a score", () => {
  const key = [
    ["1", "2"],
    ["3", "4"],
  ]
  const answers: string[][][] = [
    [
      ["1", "2"],
      ["3", "4"],
    ],
    [
      ["1.0", "2"],
      ["3", "4"],
    ],
    [
      ["1", "2"],
      ["3", "5"],
    ],
    [["1", "2"]],
    [
      ["1", "2", "9"],
      ["3", "4", "9"],
    ],
  ]

  test.each(answers.map((matrix, index) => [index, matrix]))(
    "answer %i scores at least what v4 gave it",
    (_index, matrix) => {
      const item = migrateMatrixItem({ optionCells: key })
      const answer: UserItemAnswerMatrix = {
        type: "matrix",
        valid: true,
        quizItemId: "matrix-item",
        matrix: matrix as string[][],
      }
      const migratedScore = assessMatrixQuiz(answer, item).correctnessCoefficient
      const v4Score = gradedCorrectlyUnderV4(matrix as string[][], key) ? 1 : 0
      expect(migratedScore).toBeGreaterThanOrEqual(v4Score)
    },
  )
})
