import { wordCount } from "@/shared-module/common/utils/strings"

import type { UserItemAnswerEssay } from "../../../types/quizTypes/answer"
import type { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import type { PrivateSpecQuizItemEssay } from "../../../types/quizTypes/privateSpec"

const assessEssay = (
  quizItemAnswer: UserItemAnswerEssay,
  quizItem: PrivateSpecQuizItemEssay,
): QuizItemAnswerGrading => {
  if (!quizItemAnswer.textData) {
    throw new Error("Essay was not provided")
  }

  const words = wordCount(quizItemAnswer.textData)
  let correct = true

  if (quizItem.minWords && words < quizItem.minWords) {
    correct = false
  }
  if (quizItem.maxWords && words > quizItem.maxWords) {
    correct = false
  }

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessEssay }
