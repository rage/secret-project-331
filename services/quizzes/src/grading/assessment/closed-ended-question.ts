import { stripNonPrintableCharacters } from "@/shared-module/common/utils/strings"

import type { UserItemAnswerClosedEndedQuestion } from "../../../types/quizTypes/answer"
import type { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import type { PrivateSpecQuizItemClosedEndedQuestion } from "../../../types/quizTypes/privateSpec"

const assessClosedEndedQuestion = (
  quizItemAnswer: UserItemAnswerClosedEndedQuestion,
  quizItem: PrivateSpecQuizItemClosedEndedQuestion,
): QuizItemAnswerGrading => {
  if (!quizItemAnswer) {
    throw new Error("No answer provided")
  }

  const textData = stripNonPrintableCharacters(quizItemAnswer.textData).replaceAll("\0", "").trim()
  let correct = true
  if (quizItem.validityRegex) {
    const validityRegex = new RegExp(quizItem.validityRegex.trim())
    correct = validityRegex.test(textData)
  }

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessClosedEndedQuestion }
