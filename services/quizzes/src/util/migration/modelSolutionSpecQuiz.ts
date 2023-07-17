import {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
  ModelSolutionQuizItemCheckbox,
  ModelSolutionQuizItemChooseN,
  ModelSolutionQuizItemClosedEndedQuestion,
  ModelSolutionQuizItemEssay,
  ModelSolutionQuizItemMatrix,
  ModelSolutionQuizItemMultiplechoice,
  ModelSolutionQuizItemMultiplechoiceDropdown,
  ModelSolutionQuizItemScale,
  ModelSolutionQuizItemTimeline,
} from "../../../types/quizTypes/modelSolutionSpec"
import {
  ModelSolutionQuiz as OldModelSolutionQuiz,
  ModelSolutionQuizItem as OldModelSolutionQuizItem,
} from "../../../types/types"

import { DEFAULT_N } from "./migrationSettings"
const CHOOSE_N_DEFAULT_VALUE = DEFAULT_N
const migrateModelSolutionSpecQuizItem = (
  quizItem: OldModelSolutionQuizItem,
): ModelSolutionQuizItem => {
  switch (quizItem.type as OldQuizItemType) {
    case "essay":
      return {
        id: quizItem.id,
        type: "essay",
        body: quizItem.body,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        maxWords: quizItem.maxWords,
        minWords: quizItem.minWords,
        order: quizItem.order,
        title: quizItem.title,
      } satisfies ModelSolutionQuizItemEssay
    case "multiple-choice":
      return {
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
      } satisfies ModelSolutionQuizItemMultiplechoice
    case "scale":
      return {
        id: quizItem.id,
        type: "scale",
        order: quizItem.order,
        title: quizItem.title,
        body: quizItem.body,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        maxLabel: quizItem.maxLabel ? quizItem.maxLabel : "?",
        minLabel: quizItem.minLabel ? quizItem.minLabel : "?",
        maxValue: quizItem.maxValue,
        minValue: quizItem.minValue,
      } satisfies ModelSolutionQuizItemScale
    case "checkbox":
      return {
        id: quizItem.id,
        type: "checkbox",
        order: quizItem.order,
        body: quizItem.body,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        title: quizItem.title,
      } satisfies ModelSolutionQuizItemCheckbox
    case "open":
      return {
        id: quizItem.id,
        type: "closed-ended-question",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        formatRegex: quizItem.formatRegex,
        successMessage: quizItem.successMessage,
        failureMessage: quizItem.failureMessage,
      } satisfies ModelSolutionQuizItemClosedEndedQuestion
    case "matrix":
      return {
        id: quizItem.id,
        type: "matrix",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        optionCells: quizItem.optionCells,
        successMessage: quizItem.successMessage,
      } satisfies ModelSolutionQuizItemMatrix
    case "timeline":
      return {
        id: quizItem.id,
        type: "timeline",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        timelineItems: quizItem.timelineItems,
      } satisfies ModelSolutionQuizItemTimeline
    case "clickable-multiple-choice":
      return {
        id: quizItem.id,
        type: "choose-n",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        options: quizItem.options,
        n: CHOOSE_N_DEFAULT_VALUE,
      } satisfies ModelSolutionQuizItemChooseN
    case "multiple-choice-dropdown":
      return {
        id: quizItem.id,
        type: "multiple-choice-dropdown",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        options: quizItem.options,
      } satisfies ModelSolutionQuizItemMultiplechoiceDropdown
  }
}

const migrateModelSolutionSpecQuiz = (
  oldModelSolutionQuiz: OldModelSolutionQuiz | null,
): ModelSolutionQuiz | null => {
  if (oldModelSolutionQuiz === null) {
    return null
  }
  const modelSolutionQuiz: ModelSolutionQuiz = {
    version: "2",
    awardPointsEvenIfWrong: oldModelSolutionQuiz.awardPointsEvenIfWrong,
    body: oldModelSolutionQuiz.body,
    grantPointsPolicy: oldModelSolutionQuiz.grantPointsPolicy,
    items: [],
    submitMessage: oldModelSolutionQuiz.submitMessage,
    title: oldModelSolutionQuiz.title,
  }
  oldModelSolutionQuiz.items.forEach((quizItem) => {
    modelSolutionQuiz.items.push(migrateModelSolutionSpecQuizItem(quizItem))
  })
  return modelSolutionQuiz
}

export default migrateModelSolutionSpecQuiz
