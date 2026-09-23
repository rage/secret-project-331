import type { UserItemAnswerMatrix } from "../../../types/quizTypes/answer"
import type { MatrixDifference, QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
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

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: matrixCorrectnessCoefficient(quizItem, difference),
    matrixDifference: difference,
  }
}

const matrixCorrectnessCoefficient = (
  quizItem: PrivateSpecQuizItemMatrix,
  difference: MatrixDifference,
): number => {
  const { incorrectCells, missingCells, extraCells, keyCells } = difference.breakdown
  // An empty key defines no correct answer, which the editor blocks saving; a key that reaches
  // grading in this state is a data bug worth surfacing rather than silently scoring everyone 0.
  if (keyCells === 0) {
    throw new Error("Matrix item has no correct answer configured")
  }
  const differingCells = incorrectCells + missingCells + extraCells
  if (quizItem.gradingPolicy === "whole-matrix") {
    return differingCells === 0 ? 1 : 0
  }
  const shapesMatch = missingCells === 0 && extraCells === 0
  if (!shapesMatch && !quizItem.partialCreditForWrongShape) {
    return 0
  }
  return clamp01(1 - differingCells / keyCells)
}

export { assessMatrixQuiz }
