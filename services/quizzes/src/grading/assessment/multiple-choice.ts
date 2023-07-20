import { UserItemAnswerMultiplechoice } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemMultiplechoice } from "../../../types/quizTypes/privateSpec"
import { QuizItemAnswerGrading } from "../types"

const getMultipleChoicePointsByGradingPolicy = (
  quizItemAnswer: UserItemAnswerMultiplechoice,
  quizItem: PrivateSpecQuizItemMultiplechoice,
) => {
  if (!quizItemAnswer.selectedOptionIds) {
    return 0
  }

  // Get statistics of the answer
  const totalCorrectAnswers = quizItem.options.filter((o) => o.correct).length
  let countOfCorrectAnswers = 0
  let countOfIncorrectAnswers = 0
  quizItemAnswer.selectedOptionIds.forEach((oa) => {
    const option = quizItem.options.find((o) => o.id === oa)
    if (option && option.correct) {
      countOfCorrectAnswers++
    } else {
      countOfIncorrectAnswers++
    }
  })

  // Single choice answers
  if (!quizItem.allowSelectingMultipleOptions) {
    return countOfCorrectAnswers > 0 ? 1 : 0
  }

  // Multiple choice answers
  let totalScore = 0
  switch (quizItem.multipleChoiceMultipleOptionsGradingPolicy) {
    case "points-off-incorrect-options":
      totalScore = Math.max(0, countOfCorrectAnswers - countOfIncorrectAnswers)
      break
    case "points-off-unselected-options":
      totalScore = Math.max(
        0,
        countOfCorrectAnswers * 2 - totalCorrectAnswers - countOfIncorrectAnswers,
      )
      break
    default:
      totalScore =
        countOfCorrectAnswers == totalCorrectAnswers && countOfIncorrectAnswers == 0
          ? totalCorrectAnswers
          : 0
      break
  }

  return totalScore / totalCorrectAnswers
}

const assessMultipleChoice = (
  quizItemAnswer: UserItemAnswerMultiplechoice,
  quizItem: PrivateSpecQuizItemMultiplechoice,
): QuizItemAnswerGrading => {
  if (!quizItemAnswer.selectedOptionIds || quizItemAnswer.selectedOptionIds.length === 0) {
    throw new Error("No option answers. MultipleChoice '" + JSON.stringify(quizItemAnswer) + "'")
  }

  if (!quizItem.allowSelectingMultipleOptions && quizItemAnswer.selectedOptionIds.length > 1) {
    throw new Error("Cannot select multiple answer options on this quiz item")
  }

  const correctnessCoefficient = getMultipleChoicePointsByGradingPolicy(quizItemAnswer, quizItem)

  return {
    quizItemId: quizItem.id,
    correct: correctnessCoefficient == 1,
    correctnessCoefficient,
  }
}

export { assessMultipleChoice }
