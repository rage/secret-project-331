import { UserItemAnswerMultiplechoice } from "../../../types/quizTypes/answer"
import { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import { PrivateSpecQuizItemMultiplechoice } from "../../../types/quizTypes/privateSpec"

import { clamp01, isValidNumber, safeDivide } from "@/utils/math"

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
    case "some-correct-none-incorrect":
      totalScore =
        countOfCorrectAnswers !== 0 && countOfIncorrectAnswers == 0 ? totalCorrectAnswers : 0
      break
    default:
      totalScore =
        countOfCorrectAnswers == totalCorrectAnswers && countOfIncorrectAnswers == 0
          ? totalCorrectAnswers
          : 0
      break
  }

  // Handle case where there are no correct answers
  if (totalCorrectAnswers === 0) {
    return 0
  }

  return safeDivide(totalScore, totalCorrectAnswers)
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

  const rawCoefficient = getMultipleChoicePointsByGradingPolicy(quizItemAnswer, quizItem)
  const correctnessCoefficient = clamp01(rawCoefficient)

  // Safety check to ensure we never return invalid values
  if (!isValidNumber(correctnessCoefficient)) {
    console.error(
      "Invalid correctnessCoefficient calculated:",
      correctnessCoefficient,
      "for item:",
      quizItem.id,
      "Returning 0 instead",
    )
    return {
      quizItemId: quizItem.id,
      correctnessCoefficient: 0,
    }
  }

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient,
  }
}

export { assessMultipleChoice }
