import { QuizItemAnswerGrading } from "../../types/quizTypes/grading"
import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

const gradeAnswers = (assessedAnswer: QuizItemAnswerGrading[], quiz: PrivateSpecQuiz): number => {
  // Award points even if wrong
  const maxPoints = quiz.items.length
  if (quiz.awardPointsEvenIfWrong) {
    return maxPoints
  }
  // Calculate the score
  return quiz.items
    .map((item) => {
      const answer = assessedAnswer.find((ia) => ia.quizItemId === item.id)
      if (!answer) {
        return 0
      }
      const correctnessCoefficient = answer.correctnessCoefficient
      if (correctnessCoefficient > 1) {
        return 1
      }
      if (correctnessCoefficient < 0) {
        return 0
      }
      return correctnessCoefficient
    })
    .reduce((a, b) => a + b)
}

export { gradeAnswers }
