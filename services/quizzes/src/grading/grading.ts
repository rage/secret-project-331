import { QuizItemAnswerGrading } from "../../types/quizTypes/grading"
import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

import { isValidNumber } from "./utils/math"

const gradeAnswers = (assessedAnswer: QuizItemAnswerGrading[], quiz: PrivateSpecQuiz): number => {
  // Award points even if wrong
  const maxPoints = quiz.items.length
  if (quiz.awardPointsEvenIfWrong) {
    return maxPoints
  }
  // Calculate the score
  const score = quiz.items
    .map((item) => {
      const answer = assessedAnswer.find((ia) => ia.quizItemId === item.id)
      if (!answer) {
        return 0
      }
      const correctnessCoefficient = answer.correctnessCoefficient
      // Handle null, undefined, or invalid values
      if (correctnessCoefficient == null || !isValidNumber(correctnessCoefficient)) {
        return 0
      }
      // Clamp to [0, 1] range
      return Math.max(0, Math.min(1, correctnessCoefficient))
    })
    .reduce((a, b) => a + b, 0)

  // Final safety check to ensure we never return NaN, Infinity, or invalid values
  if (!isValidNumber(score) || score < 0) {
    console.error("Invalid score calculated:", score, "Returning 0 instead")
    return 0
  }

  return score
}

export { gradeAnswers }
