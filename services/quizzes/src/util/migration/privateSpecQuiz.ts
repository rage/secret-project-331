/* eslint-disable i18next/no-literal-string */
/* stylelint-disable */
import {
  OldNormalizedQuizItemOption,
  OldQuiz,
  OldQuizItemOption,
  QuizItem,
} from "../../../types/oldQuizTypes"
import {
  OldQuizItemType,
  PrivateSpecQuiz,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "../../../types/quizTypes/privateSpec"
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
      } satisfies PrivateSpecQuizItemEssay
    case "matrix":
      return {
        id: quizItem.id,
        type: "matrix",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        optionCells: quizItem.optionCells,
        successMessage: quizItem.successMessage,
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
      } satisfies PrivateSpecQuizItemClosedEndedQuestion
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
      } satisfies PrivateSpecQuizItemScale
    case "timeline":
      return {
        id: quizItem.id,
        type: "timeline",
        order: quizItem.order,
        failureMessage: quizItem.failureMessage,
        successMessage: quizItem.successMessage,
        timelineItems: quizItem.timelineItems,
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
      } satisfies PrivateSpecQuizItemMultiplechoiceDropdown
    default:
      console.error(`Unknown type: '${quizItem.type}'`)
  }

  // TODO: Unsupported quiz, can be cause due to typos
  return {
    id: quizItem.id,
    type: "essay",
    order: 100,
    title: "quizItem.title",
    body: "quizItem.body",
    failureMessage: "quizItem.failureMessage",
    maxWords: 100,
    minWords: 0,
    successMessage: "quizItem.successMessage",
  } satisfies PrivateSpecQuizItemEssay
}

/**
 * Migrate quiz into newer format.
 *
 * @param oldQuiz Older version of Quiz
 * @see OldQuiz
 * @see PrivateSpecQuiz
 * @returns New version of Quiz
 */
export const migratePrivateSpecQuiz = (oldQuiz: OldQuiz): PrivateSpecQuiz => {
  const privateSpecQuiz: PrivateSpecQuiz = {
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
