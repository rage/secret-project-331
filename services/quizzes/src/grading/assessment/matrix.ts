import type { UserItemAnswerMatrix } from "../../../types/quizTypes/answer"
import type { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import type { PrivateSpecQuizItemMatrix } from "../../../types/quizTypes/privateSpec"

const assessMatrixQuiz = (
  quizItemAnswer: UserItemAnswerMatrix,
  quizItem: PrivateSpecQuizItemMatrix,
): QuizItemAnswerGrading => {
  const userAnswer = quizItemAnswer.matrix
  const correctAnswer = quizItem.optionCells

  if (!userAnswer) {
    throw new Error("Answer not provided")
  }

  if (!correctAnswer) {
    throw new Error("No correct answer")
  }

  const isMatrixCorrect: boolean[] = []
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      // safe: matrices are fixed 6x6 grids, so indices 0..5 are always present
      isMatrixCorrect.push(correctAnswer[i]?.[j] === userAnswer[i]?.[j])
    }
  }

  const correct = !isMatrixCorrect.includes(false)

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessMatrixQuiz }
