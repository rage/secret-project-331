/* stylelint-disable */
import type {
  OldNormalizedQuizItemOption,
  OldQuiz,
  OldQuizItemOption,
  QuizItem,
} from "../../../types/oldQuizTypes"
import type { OldQuizItemType } from "../../../types/quizTypes/oldQuizTypes"
import type {
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "../../../types/quizTypes/privateSpec"
import type {
  PrivateSpecQuizItemClosedEndedQuestionV2,
  PrivateSpecQuizV2,
} from "../../../types/quizTypes/v2"
import { sanitizeQuizDirection } from "../css-sanitization"
import { DEFAULT_N } from "./migrationSettings"

const CHOOSE_N_DEFAULT_VALUE = DEFAULT_N

export const convertNormalizedQuizItemOptionsToQuizItemOptions = (
  quizOptions: OldNormalizedQuizItemOption[],
) => {
  const result: OldQuizItemOption[] = quizOptions.map((item) => ({
    id: item.id,
    quizItemId: item.quizItemId,
    order: item.order,
    correct: item.correct,
    createdAt: new Date(),
    updatedAt: new Date(),
    title: item.title,
    body: item.body,
    messageAfterSubmissionWhenSelected: item.messageAfterSubmissionWhenSelected,
    additionalCorrectnessExplanationOnModelSolution:
      item.additionalCorrectnessExplanationOnModelSolution,
  }))

  return result
}

export const migratePrivateSpecQuizItem = (quizItem: QuizItem) => {
  switch (quizItem.type as OldQuizItemType) {
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
      } satisfies PrivateSpecQuizItemCheckbox
    case "essay":
      return {
        id: quizItem.id,
        type: "essay",
        order: quizItem.order,
        title: quizItem.title,
        body: quizItem.body,
        failureMessage: quizItem.failureMessage,
        maxWords: quizItem.maxWords,
        minWords: quizItem.minWords,
        successMessage: quizItem.successMessage,
        messageOnModelSolution: null,
      } satisfies PrivateSpecQuizItemEssay
    case "matrix":
      return {
        id: quizItem.id,
        type: "matrix",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        optionCells: quizItem.optionCells,
        successMessage: quizItem.successMessage,
        messageOnModelSolution: null,
      } satisfies PrivateSpecQuizItemMatrix
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
        fogOfWar: false,
        messageOnModelSolution: null,
      } satisfies PrivateSpecQuizItemMultiplechoice
    case "open":
      return {
        id: quizItem.id,
        type: "closed-ended-question",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        formatRegex: quizItem.formatRegex,
        validityRegex: quizItem.validityRegex,
        successMessage: quizItem.successMessage,
        failureMessage: quizItem.failureMessage,
        messageOnModelSolution: null,
      } satisfies PrivateSpecQuizItemClosedEndedQuestionV2
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
      } satisfies PrivateSpecQuizItemScale
    case "timeline":
      return {
        id: quizItem.id,
        type: "timeline",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        timelineItems: quizItem.timelineItems,
        messageOnModelSolution: null,
      } satisfies PrivateSpecQuizItemTimeline
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
      } satisfies PrivateSpecQuizItemChooseN
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
      } satisfies PrivateSpecQuizItemMultiplechoiceDropdown
    default:
      // The v1 item-type set is closed and historical, so an unknown type means corrupt data.
      // Fail loud rather than fabricating a placeholder item that would be persisted on next save.
      throw new Error(`Unknown quiz item type: '${quizItem.type}'`)
  }
}

/**
 * Migrate quiz into newer format.
 *
 * @param oldQuiz Older version of Quiz
 * @see OldQuiz
 * @see PrivateSpecQuizV2
 * @returns The v2 version of the quiz (later lifted to the latest version by the migration chain)
 */
export const migratePrivateSpecQuiz = (oldQuiz: OldQuiz): PrivateSpecQuizV2 => {
  const privateSpecQuiz: PrivateSpecQuizV2 = {
    version: "2",
    title: oldQuiz.title,
    body: oldQuiz.body,
    awardPointsEvenIfWrong: oldQuiz.awardPointsEvenIfWrong,
    grantPointsPolicy: oldQuiz.grantPointsPolicy,
    submitMessage: oldQuiz.submitMessage,
    quizItemDisplayDirection: sanitizeQuizDirection(oldQuiz.direction),
    items: [],
  }

  oldQuiz.items.forEach((quizItem) => {
    privateSpecQuiz.items.push(migratePrivateSpecQuizItem(quizItem))
  })

  return privateSpecQuiz
}
