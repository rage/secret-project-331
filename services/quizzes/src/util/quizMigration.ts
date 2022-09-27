/* eslint-disable i18next/no-literal-string */
import {
  OldQuizItemType,
  PrivateSpecQuiz,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "../../types/quizTypes"
import { Quiz } from "../../types/types"

/**
 * Check if the quiz version is old.
 *
 * @param quiz Quiz
 * @returns True if the quiz is older format, false if not
 */
export const isOldQuiz = (quiz: Quiz | PrivateSpecQuiz) => {
  return !Object.prototype.hasOwnProperty.call(quiz, "version")
}

/**
 * Migrate quiz into newer format.
 *
 * @param oldQuiz Older version of Quiz
 * @see Quiz
 * @see PrivateSpecQuiz
 * @returns New version of Quiz
 */
export const migrateQuiz = (oldQuiz: Quiz): PrivateSpecQuiz => {
  const privateSpecQuiz: PrivateSpecQuiz = {
    version: "2",
    id: oldQuiz.id,
    title: oldQuiz.title,
    body: oldQuiz.body,
    awardPointsEvenIfWrong: oldQuiz.awardPointsEvenIfWrong,
    grantPointsPolicy: oldQuiz.grantPointsPolicy,
    submitMessage: oldQuiz.submitMessage,
    items: [],
  }

  oldQuiz.items.forEach((quizItem) => {
    switch (quizItem.type as OldQuizItemType) {
      case "checkbox":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "checkbox",
          order: quizItem.order,
          body: quizItem.body,
          failureMessage: quizItem.failureMessage,
          successMessage: quizItem.successMessage,
          title: quizItem.title,
        } as PrivateSpecQuizItemCheckbox)
        break
      case "essay":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "essay",
          order: quizItem.order,
          title: quizItem.title,
          body: quizItem.body,
          failureMessage: quizItem.failureMessage,
          maxWords: quizItem.maxWords,
          minWords: quizItem.minWords,
          successMessage: quizItem.successMessage,
        } as PrivateSpecQuizItemEssay)
        break
      case "matrix":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "matrix",
          order: quizItem.order,
          failureMessage: quizItem.failureMessage,
          optionCells: quizItem.optionCells,
          successMessage: quizItem.successMessage,
        } as PrivateSpecQuizItemMatrix)
        break
      case "multiple-choice":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "multiple-choice",
          order: quizItem.order,
          title: quizItem.title,
          body: quizItem.body,
          multipleChoiceMultipleOptionsGradingPolicy:
            quizItem.multipleChoiceMultipleOptionsGradingPolicy,
          allowSelectingMultipleOptions: quizItem.multi,
          direction: quizItem.direction,
          failureMessage: quizItem.failureMessage,
          successMessage: quizItem.successMessage,
          sharedOptionFeedbackMessage: quizItem.sharedOptionFeedbackMessage,
          options: quizItem.options,
          shuffleOptions: quizItem.shuffleOptions,
        } as PrivateSpecQuizItemMultiplechoice)
        break
      case "open":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "closed-ended-question",
          order: quizItem.order,
          body: quizItem.body,
          title: quizItem.title,
          formatRegex: quizItem.formatRegex,
          validityRegex: quizItem.validityRegex,
          successMessage: quizItem.successMessage,
          failureMessage: quizItem.failureMessage,
        } as PrivateSpecQuizItemClosedEndedQuestion)
        break
      case "scale":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "scale",
          order: quizItem.order,
          title: quizItem.title,
          body: quizItem.body,
          failureMessage: quizItem.failureMessage,
          successMessage: quizItem.successMessage,
          maxLabel: quizItem.maxLabel,
          minLabel: quizItem.minLabel,
          maxValue: quizItem.maxValue,
          minValue: quizItem.minValue,
        } as PrivateSpecQuizItemScale)
        break
      case "timeline":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "timeline",
          order: quizItem.order,
          failureMessage: quizItem.failureMessage,
          successMessage: quizItem.successMessage,
          timelineItems: quizItem.timelineItems,
        } as PrivateSpecQuizItemTimeline)
        break
      case "clickable-multiple-choice":
        privateSpecQuiz.items.push({
          id: quizItem.id,
          type: "choose-n",
          order: quizItem.order,
          body: quizItem.body,
          title: quizItem.title,
          failureMessage: quizItem.failureMessage,
          successMessage: quizItem.successMessage,
          options: quizItem.options,
        } as PrivateSpecQuizItemChooseN)
        break
      default:
        console.error(`Unknown type: '${quizItem.type}'`)
    }
  })

  return privateSpecQuiz
}
