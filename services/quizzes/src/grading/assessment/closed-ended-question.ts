import { UserItemAnswerClosedEndedQuestion } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemClosedEndedQuestion } from "../../../types/quizTypes/privateSpec"
import { stripNonPrintableCharacters } from "../../shared-module/utils/strings"

const assessClosedEndedQuestion = (
  quizItemAnswer: UserItemAnswerClosedEndedQuestion,
  quizItem: PrivateSpecQuizItemClosedEndedQuestion,
) => {
  if (!quizItemAnswer) {
    throw new Error("No answer provided")
  }

  const textData = stripNonPrintableCharacters(quizItemAnswer.textData).replace(/\0/g, "").trim()
  let correct = true
  if (quizItem.validityRegex) {
    const validityRegex = new RegExp(quizItem.validityRegex.trim())
    correct = validityRegex.test(textData)
  }

  return {
    quizItemId: quizItem.id,
    correct,
    correctnessCoefficient: correct ? 1 : 0,
  }
}

export { assessClosedEndedQuestion }
