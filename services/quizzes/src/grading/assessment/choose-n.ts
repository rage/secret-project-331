import { UserItemAnswerChooseN } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemChooseN } from "../../../types/quizTypes/privateSpec"

const assessChooseN = (
  quizItemAnswer: UserItemAnswerChooseN,
  quizItem: PrivateSpecQuizItemChooseN,
) => {
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
  const correct = quizItemAnswer.selectedOptionIds.length == quizItem.n

  return {
    quizItemId: quizItem.id,
    correct,
    correctnessCoefficient: correctOptions / totalCorrectOptions,
  }
}

export { assessChooseN }
