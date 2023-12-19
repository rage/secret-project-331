import { UserAnswer } from "../../../types/quizTypes/answer"
import { QuizItemAnswerGrading } from "../../../types/quizTypes/grading"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemTimeline,
} from "../../../types/quizTypes/privateSpec"

import { assessChooseN } from "./choose-n"
import { assessClosedEndedQuestion } from "./closed-ended-question"
import { assessEssay } from "./essay"
import { assessMatrixQuiz } from "./matrix"
import { assessMultipleChoice } from "./multiple-choice"
import { assessMultipleChoiceDropdown } from "./multiple-choice-dropdown"
import { assessTimeline } from "./timeline"

const assessAnswers = (quizAnswer: UserAnswer, quiz: PrivateSpecQuiz): QuizItemAnswerGrading[] => {
  if (!quizAnswer) {
    throw new Error("Quiz answer was not provided")
  }
  if (!quiz) {
    throw new Error("Quiz was not provided")
  }
  return quizAnswer.itemAnswers.map((itemAnswer) => {
    const quizItem = quiz.items.find((quizItem) => quizItem.id === itemAnswer.quizItemId)
    if (!quizItem) {
      const allAvailableIds = quiz.items.map((item) => item.id)
      const allAnsweredIds = quizAnswer.itemAnswers.map((item) => item.quizItemId)
      throw new Error(
        "Answer included an answer to an item that was not in the quiz. Answered item ids: " +
          allAnsweredIds.join(", ") +
          ". Available ids: " +
          allAvailableIds.join(", "),
      )
    }
    switch (itemAnswer.type) {
      case "multiple-choice":
        return assessMultipleChoice(itemAnswer, quizItem as PrivateSpecQuizItemMultiplechoice)
      case "multiple-choice-dropdown":
        return assessMultipleChoiceDropdown(
          itemAnswer,
          quizItem as PrivateSpecQuizItemMultiplechoiceDropdown,
        )
      case "choose-n":
        return assessChooseN(itemAnswer, quizItem as PrivateSpecQuizItemChooseN)
      case "closed-ended-question":
        return assessClosedEndedQuestion(
          itemAnswer,
          quizItem as PrivateSpecQuizItemClosedEndedQuestion,
        )
      case "timeline":
        return assessTimeline(itemAnswer, quizItem as PrivateSpecQuizItemTimeline)
      case "essay":
        return assessEssay(itemAnswer, quizItem as PrivateSpecQuizItemEssay)
      case "matrix":
        return assessMatrixQuiz(itemAnswer, quizItem as PrivateSpecQuizItemMatrix)
      case "checkbox":
      case "scale":
        return {
          quizItemId: itemAnswer.quizItemId,
          correctnessCoefficient: 1,
        } satisfies QuizItemAnswerGrading
    }
  })
}
export { assessAnswers }
