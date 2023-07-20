import { UserItemAnswerChooseN } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemChooseN } from "../../../types/quizTypes/privateSpec"

const assessChooseN = (
  quizItemAnswer: UserItemAnswerChooseN,
  quizItem: PrivateSpecQuizItemChooseN,
) => {
  if (!quizItemAnswer.selectedOptionIds) {
    throw new Error("No options selected")
  }

  const correct = quizItemAnswer.selectedOptionIds.length == quizItem.n

  return {
    quizItemId: quizItem.id,
    correct,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessChooseN }
