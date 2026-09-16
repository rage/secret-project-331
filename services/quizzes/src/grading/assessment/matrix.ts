import type { UserItemAnswerMatrix } from "../../../types/quizTypes/answer"
import type { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import type { PrivateSpecQuizItemMatrix } from "../../../types/quizTypes/privateSpec"
import { clamp01 } from "../utils/math"
import { compareMatrices } from "../utils/matrixDifference"

const assessMatrixQuiz = (
  quizItemAnswer: UserItemAnswerMatrix,
  quizItem: PrivateSpecQuizItemMatrix,
): QuizItemAnswerGrading => {
  if (!quizItemAnswer.matrix) {
    throw new Error("Answer not provided")
  }

  const difference = compareMatrices(
    quizItemAnswer.matrix,
    quizItem.optionCells,
    quizItem.tolerance,
  )
  const { keyCells } = difference.breakdown

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: correctnessCoefficient(quizItem, difference, keyCells),
  }
}

const correctnessCoefficient = (
  quizItem: PrivateSpecQuizItemMatrix,
  difference: { differingCells: number; shapesMatch: boolean },
  keyCells: number,
): number => {
  // An empty key defines no correct answer, so nothing can match it.
  if (keyCells === 0) {
    return 0
  }
  if (quizItem.gradingPolicy === "whole-matrix") {
    return difference.differingCells === 0 ? 1 : 0
  }
  if (!difference.shapesMatch && !quizItem.partialCreditForWrongShape) {
    return 0
  }
  return clamp01(1 - difference.differingCells / keyCells)
}

export { assessMatrixQuiz }
