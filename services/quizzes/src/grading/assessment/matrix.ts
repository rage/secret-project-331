import { UserItemAnswerMatrix } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemMatrix } from "../../../types/quizTypes/privateSpec"
import { QuizItemAnswerGrading } from "../types"

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
      isMatrixCorrect.push(correctAnswer[i][j] === userAnswer[i][j])
    }
  }

  const correct = !isMatrixCorrect.includes(false)

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessMatrixQuiz }
