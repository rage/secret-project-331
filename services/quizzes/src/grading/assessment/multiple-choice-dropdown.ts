import { UserItemAnswerMultiplechoiceDropdown } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemMultiplechoiceDropdown } from "../../../types/quizTypes/privateSpec"

const assessMultipleChoiceDropdown = (
  quizItemAnswer: UserItemAnswerMultiplechoiceDropdown,
  quizItem: PrivateSpecQuizItemMultiplechoiceDropdown,
) => {
  if (!quizItemAnswer.selectedOptionIds) {
    throw new Error(
      "No options selected for multiple choice dropdown: '" + JSON.stringify(quizItemAnswer) + "'",
    )
  }

  const correct = quizItemAnswer.selectedOptionIds.length == 1

  return {
    quizItemId: quizItem.id,
    correct,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessMultipleChoiceDropdown }
