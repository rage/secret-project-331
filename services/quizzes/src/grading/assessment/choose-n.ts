import { UserItemAnswerChooseN } from "../../../types/quizTypes/answer"
import { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import { PrivateSpecQuizItemChooseN } from "../../../types/quizTypes/privateSpec"

import { clamp01, safeDivide } from "@/utils/math"

const assessChooseN = (
  quizItemAnswer: UserItemAnswerChooseN,
  quizItem: PrivateSpecQuizItemChooseN,
): QuizItemAnswerGrading => {
  if (!quizItemAnswer.selectedOptionIds) {
    throw new Error("No options selected")
  }
  const totalCorrectOptions = quizItem.options.filter((item) => item.correct).length
  let correctOptions = 0
  quizItemAnswer.selectedOptionIds.forEach((selectedOption) => {
    const option = quizItem.options.filter((item) => item.id === selectedOption)[0]
    if (option && option.correct) {
      correctOptions++
    }
  })

  const denominator = Math.min(quizItem.n, totalCorrectOptions)
  const rawCoefficient = safeDivide(correctOptions, denominator)
  const correctnessCoefficient = clamp01(rawCoefficient)

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient,
  }
}

export { assessChooseN }
