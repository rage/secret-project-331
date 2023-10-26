import { UserItemAnswerChooseN } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemChooseN } from "../../../types/quizTypes/privateSpec"
import { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"

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

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: correctOptions / Math.min(quizItem.n, totalCorrectOptions),
  }
}

export { assessChooseN }
