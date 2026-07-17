import type { OldModelSolutionQuiz, OldModelSolutionQuizItem } from "../../../types/oldQuizTypes"
import type {
  ModelSolutionQuizItemCheckbox,
  ModelSolutionQuizItemChooseN,
  ModelSolutionQuizItemEssay,
  ModelSolutionQuizItemMatrix,
  ModelSolutionQuizItemMultiplechoice,
  ModelSolutionQuizItemMultiplechoiceDropdown,
  ModelSolutionQuizItemScale,
  ModelSolutionQuizItemTimeline,
} from "../../../types/quizTypes/modelSolutionSpec"
import type { OldQuizItemType } from "../../../types/quizTypes/oldQuizTypes"
import type {
  ModelSolutionQuizItemClosedEndedQuestionV2,
  ModelSolutionQuizItemV2,
  ModelSolutionQuizV2,
} from "../../../types/quizTypes/v2"
import { sanitizeQuizDirection } from "../css-sanitization"
import { DEFAULT_N } from "./migrationSettings"
const CHOOSE_N_DEFAULT_VALUE = DEFAULT_N
const migrateModelSolutionSpecQuizItem = (
  quizItem: OldModelSolutionQuizItem,
): ModelSolutionQuizItemV2 => {
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
        messageOnModelSolution: null,
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
        optionDisplayDirection: sanitizeQuizDirection(quizItem.direction),
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        sharedOptionFeedbackMessage: quizItem.sharedOptionFeedbackMessage,
        options: quizItem.options,
        shuffleOptions: quizItem.shuffleOptions,
        messageOnModelSolution: null,
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
        messageOnModelSolution: null,
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
        messageOnModelSolution: null,
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
        messageOnModelSolution: null,
      } satisfies ModelSolutionQuizItemClosedEndedQuestionV2
    case "matrix":
      return {
        id: quizItem.id,
        type: "matrix",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        optionCells: quizItem.optionCells,
        successMessage: quizItem.successMessage,
        messageOnModelSolution: null,
      } satisfies ModelSolutionQuizItemMatrix
    case "timeline":
      return {
        id: quizItem.id,
        type: "timeline",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        timelineItems: quizItem.timelineItems,
        messageOnModelSolution: null,
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
        messageOnModelSolution: null,
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
        messageOnModelSolution: null,
      } satisfies ModelSolutionQuizItemMultiplechoiceDropdown
    default:
      throw new Error(`Unknown quiz item type: '${quizItem.type}'`)
  }
}

const migrateModelSolutionSpecQuiz = (
  oldModelSolutionQuiz: OldModelSolutionQuiz | null,
): ModelSolutionQuizV2 | null => {
  if (oldModelSolutionQuiz === null) {
    return null
  }
  const modelSolutionQuiz: ModelSolutionQuizV2 = {
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
