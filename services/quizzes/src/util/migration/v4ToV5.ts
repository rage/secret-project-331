/**
 * v4 -> v5 migration.
 *
 * v5 gives the matrix item a grading policy, a numeric tolerance, a wrong-shape switch and a fog of
 * war flag. Every existing item lands on `whole-matrix` with a zero tolerance, which is the closest
 * policy to v4's raw string comparison and can only ever raise a stored score: an answer that
 * matched v4's byte-for-byte comparison necessarily has the same dimensions and the same value in
 * every cell, so it still scores 1 here.
 *
 * Cells holding only whitespace become empty, so the frame the grader computes matches the frame
 * the editor drew. A key that is null or has nothing in it becomes a well-formed empty grid: the
 * item still cannot be answered correctly, but it fails as a wrong answer instead of a 500.
 */
import { emptyMatrixGrid, MATRIX_GRID_SIZE } from "@/util/matrix"

import type { UserAnswer } from "../../../types/quizTypes/answer"
import type {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
} from "../../../types/quizTypes/modelSolutionSpec"
import type { PrivateSpecQuiz, PrivateSpecQuizItem } from "../../../types/quizTypes/privateSpec"
import type { PublicSpecQuiz } from "../../../types/quizTypes/publicSpec"
import type {
  ModelSolutionQuizItemV4,
  ModelSolutionQuizV4,
  PrivateSpecQuizItemV4,
  PrivateSpecQuizV4,
  PublicSpecQuizV4,
  UserAnswerV4,
} from "../../../types/quizTypes/v4"

const migrateOptionCells = (optionCells: string[][] | null): string[][] => {
  const normalized = (optionCells ?? []).map((row) =>
    (row ?? []).map((cell) => (typeof cell === "string" && cell.trim() !== "" ? cell : "")),
  )
  const hasContent = normalized.some((row) => row.some((cell) => cell !== ""))
  if (!hasContent) {
    return emptyMatrixGrid()
  }
  const rows = Math.max(MATRIX_GRID_SIZE, normalized.length)
  // One column count for the whole grid, or a legacy matrix whose rows had different lengths
  // would migrate into a result that is still ragged.
  const columns = Math.max(MATRIX_GRID_SIZE, ...normalized.map((row) => row.length))
  return Array.from({ length: rows }, (_unusedRow, rowIndex) => {
    const row = normalized[rowIndex] ?? []
    return Array.from({ length: columns }, (_unusedCell, columnIndex) => row[columnIndex] ?? "")
  })
}

const migratePrivateSpecItem = (item: PrivateSpecQuizItemV4): PrivateSpecQuizItem => {
  if (item.type !== "matrix") {
    return item
  }
  return {
    ...item,
    optionCells: migrateOptionCells(item.optionCells),
    gradingPolicy: "whole-matrix",
    tolerance: 0,
    partialCreditForWrongShape: false,
    fogOfWar: false,
  }
}

const migrateModelSolutionItem = (item: ModelSolutionQuizItemV4): ModelSolutionQuizItem => {
  if (item.type !== "matrix") {
    return item
  }
  return {
    ...item,
    optionCells: migrateOptionCells(item.optionCells),
    gradingPolicy: "whole-matrix",
  }
}

export const migratePrivateSpecV4ToV5 = (quiz: PrivateSpecQuizV4): PrivateSpecQuiz => ({
  ...quiz,
  version: "5",
  items: quiz.items.map(migratePrivateSpecItem),
})

export const migrateModelSolutionV4ToV5 = (quiz: ModelSolutionQuizV4): ModelSolutionQuiz => ({
  ...quiz,
  version: "5",
  items: quiz.items.map(migrateModelSolutionItem),
})

export const migratePublicSpecV4ToV5 = (quiz: PublicSpecQuizV4): PublicSpecQuiz => {
  // The public spec never carried the matrix key, so only the version literal changes.
  return { ...quiz, version: "5" }
}

export const migrateUserAnswerV4ToV5 = (answer: UserAnswerV4): UserAnswer => {
  // The answer shape is structurally unchanged between v4 and v5.
  return { ...answer, version: "5" }
}
