/**
 * v4 -> v5 migration.
 *
 * v5 gives the matrix item a grading policy, a numeric tolerance, a wrong-shape switch and a fog of
 * war flag. Every existing item lands on `whole-matrix` with a zero tolerance, the closest policy to
 * v4's raw string comparison.
 *
 * The key is cropped to the 6x6 grid v4 graded, and whitespace-only cells become empty so the
 * grader's frame matches the editor's. A whitespace cell inside the frame leaves a gap, which the
 * grader reports as a failed grading until the teacher fills it.
 */
import { emptyMatrixGrid } from "@/util/matrix"

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

const migrateOptionCells = (optionCells: string[][] | null): string[][] =>
  emptyMatrixGrid().map((row, rowIndex) =>
    row.map((_unusedCell, columnIndex) => {
      const cell: unknown = optionCells?.[rowIndex]?.[columnIndex]
      return typeof cell === "string" && cell.trim() !== "" ? cell : ""
    }),
  )

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
