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

  // No option was selected
  if (quizItemAnswer.selectedOptionIds.length == 0) {
    return {
      quizItemId: quizItem.id,
      correct: false,
      correctnessCoefficient: 0,
    }
  }

  const selectedOption = quizItemAnswer.selectedOptionIds[0]
  const answer = quizItem.options.find((item) => item.id == selectedOption)

  // Answer does not exist in quiz item
  if (!answer) {
    return {
      quizItemId: quizItem.id,
      correct: false,
      correctnessCoefficient: 0,
    }
  }

  return {
    quizItemId: quizItem.id,
    correct: answer.correct,
    correctnessCoefficient: answer.correct ? 1 : 0,
  }
}

export { assessMultipleChoiceDropdown }
