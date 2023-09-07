import {
  UserAnswer,
  UserItemAnswer,
  UserItemAnswerCheckbox,
  UserItemAnswerChooseN,
  UserItemAnswerClosedEndedQuestion,
  UserItemAnswerEssay,
  UserItemAnswerMatrix,
  UserItemAnswerMultiplechoice,
  UserItemAnswerMultiplechoiceDropdown,
  UserItemAnswerScale,
  UserItemAnswerTimeline,
} from "../../../types/quizTypes/answer"
import { PrivateSpecQuiz, PrivateSpecQuizItem } from "../../../types/quizTypes/privateSpec"
import { PublicSpecQuiz, PublicSpecQuizItem } from "../../../types/quizTypes/publicSpec"
import { QuizAnswer, QuizItemAnswer } from "../../../types/types"

const convertIntDataForScale = (quizItemAnswer: QuizItemAnswer) => {
  if (!quizItemAnswer.intData) {
    if (quizItemAnswer.optionAnswers && quizItemAnswer.optionAnswers.length > 0) {
      try {
        return Number.parseInt(quizItemAnswer.optionAnswers[0])
      } catch (e) {
        console.error("Scale does not have int data: ", quizItemAnswer)
      }
    }
  }
  return quizItemAnswer.intData
}

const migrateQuizItemAnswer = (
  quizItemAnswer: QuizItemAnswer,
  quizItem: PrivateSpecQuizItem | PublicSpecQuizItem,
): UserItemAnswer => {
  switch (quizItem.type) {
    case "essay":
      return {
        id: quizItemAnswer.id,
        type: "essay",
        quizItemId: quizItemAnswer.quizItemId,
        textData: quizItemAnswer.textData,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerEssay
    case "multiple-choice":
      return {
        id: quizItemAnswer.id,
        type: "multiple-choice",
        quizItemId: quizItemAnswer.quizItemId,
        selectedOptionIds: quizItemAnswer.optionAnswers,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerMultiplechoice
    case "scale":
      return {
        id: quizItemAnswer.id,
        intData: convertIntDataForScale(quizItemAnswer),
        quizItemId: quizItemAnswer.quizItemId,
        type: "scale",
        valid: quizItemAnswer.valid,
      } as UserItemAnswerScale
    case "checkbox":
      return {
        id: quizItemAnswer.id,
        type: "checkbox",
        checked: quizItemAnswer.intData == 1,
        quizItemId: quizItemAnswer.quizItemId,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerCheckbox
    case "closed-ended-question":
      return {
        id: quizItemAnswer.id,
        type: "closed-ended-question",
        quizItemId: quizItemAnswer.quizItemId,
        textData: quizItemAnswer.textData,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerClosedEndedQuestion
    case "matrix":
      return {
        id: quizItemAnswer.id,
        quizItemId: quizItemAnswer.quizItemId,
        type: "matrix",
        matrix: quizItemAnswer.optionCells,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerMatrix
    case "timeline":
      return {
        id: quizItemAnswer.id,
        type: "timeline",
        quizItemId: quizItemAnswer.quizItemId,
        timelineChoices: quizItemAnswer.timelineChoices,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerTimeline
    case "choose-n":
      return {
        id: quizItemAnswer.id,
        type: "choose-n",
        quizItemId: quizItemAnswer.quizItemId,
        selectedOptionIds: quizItemAnswer.optionAnswers,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerChooseN
    case "multiple-choice-dropdown":
      return {
        id: quizItemAnswer.id,
        type: "multiple-choice-dropdown",
        quizItemId: quizItemAnswer.quizItemId,
        selectedOptionIds: quizItemAnswer.optionAnswers,
        valid: quizItemAnswer.valid,
      } as UserItemAnswerMultiplechoiceDropdown
  }
}

const migrateQuizAnswer = (
  quizAnswer: QuizAnswer | null,
  privateSpecQuiz: PrivateSpecQuiz | PublicSpecQuiz | null,
): UserAnswer | null => {
  if (quizAnswer === null || privateSpecQuiz === null) {
    return null
  }
  const userAnswer: UserAnswer = {
    itemAnswers: [],
    version: "2",
  }

  const privateSpecQuizItems: { [id: string]: PrivateSpecQuizItem | PublicSpecQuizItem } = {}
  privateSpecQuiz.items.forEach((item) => {
    privateSpecQuizItems[item.id] = item as unknown as PublicSpecQuizItem
  })

  quizAnswer.itemAnswers.forEach((answer) => {
    const answerQuizItem = privateSpecQuizItems[answer.quizItemId]
    if (!answerQuizItem) {
      // eslint-disable-next-line i18next/no-literal-string
      throw new Error(`Couldn't find quiz item id '${answer.quizItemId}' for answer '${answer.id}'`)
    }
    userAnswer.itemAnswers.push(migrateQuizItemAnswer(answer, answerQuizItem))
  })

  return userAnswer
}

export default migrateQuizAnswer
