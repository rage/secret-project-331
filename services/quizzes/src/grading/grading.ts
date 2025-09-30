import { QuizItemAnswerGrading } from "../../types/quizTypes/grading"
import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

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
      // Handle null, undefined, or NaN values
      if (correctnessCoefficient == null || isNaN(correctnessCoefficient)) {
        return 0
      }
      if (correctnessCoefficient > 1) {
        return 1
      }
      if (correctnessCoefficient < 0) {
        return 0
      }
      return correctnessCoefficient
    })
    .reduce((a, b) => a + b, 0)

  // Final safety check to ensure we never return NaN, Infinity, or invalid values
  if (!Number.isFinite(score) || score < 0) {
    console.error("Invalid score calculated:", score, "Returning 0 instead")
    return 0
  }

  return score
}

export { gradeAnswers }
