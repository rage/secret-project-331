import {
  PublicSpecQuiz,
  PublicSpecQuizItem,
  PublicSpecQuizItemCheckbox,
  PublicSpecQuizItemChooseN,
  PublicSpecQuizItemClosedEndedQuestion,
  PublicSpecQuizItemEssay,
  PublicSpecQuizItemMatrix,
  PublicSpecQuizItemMultiplechoice,
  PublicSpecQuizItemMultiplechoiceDropdown,
  PublicSpecQuizItemScale,
  PublicSpecQuizItemTimeline,
} from "../../../types/quizTypes/publicSpec"
import { PublicQuiz, PublicQuizItem } from "../../../types/types"

import { DEFAULT_N } from "./migrationSettings"

const CHOOSE_N_DEFAULT_VALUE = DEFAULT_N

const migratePublicSpecQuizItem = (quizItem: PublicQuizItem): PublicSpecQuizItem => {
  switch (quizItem.type as OldQuizItemType) {
    case "essay":
      return {
        id: quizItem.id,
        type: "essay",
        order: quizItem.order,
        maxWords: quizItem.maxWords,
        minWords: quizItem.minWords,
        title: quizItem.title,
        body: quizItem.body,
      } satisfies PublicSpecQuizItemEssay
    case "multiple-choice":
      return {
        id: quizItem.id,
        type: "multiple-choice",
        allowSelectingMultipleOptions: quizItem.multi,
        body: quizItem.body,
        direction: quizItem.direction,
        multipleChoiceMultipleOptionsGradingPolicy:
          quizItem.multipleChoiceMultipleOptionsGradingPolicy,
        options: quizItem.options,
        order: quizItem.order,
        shuffleOptions: quizItem.shuffleOptions,
        title: quizItem.title,
      } satisfies PublicSpecQuizItemMultiplechoice
      break
    case "scale":
      return {
        id: quizItem.id,
        type: "scale",
        order: quizItem.order,
        title: quizItem.title,
        body: quizItem.body,
        maxLabel: quizItem.maxLabel ? quizItem.maxLabel : "?",
        minLabel: quizItem.minLabel ? quizItem.minLabel : "?",
        maxValue: quizItem.maxValue,
        minValue: quizItem.minValue,
      } satisfies PublicSpecQuizItemScale
    case "checkbox":
      return {
        id: quizItem.id,
        type: "checkbox",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
      } satisfies PublicSpecQuizItemCheckbox
    case "open":
      return {
        id: quizItem.id,
        type: "closed-ended-question",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        formatRegex: quizItem.formatRegex,
      } satisfies PublicSpecQuizItemClosedEndedQuestion
    case "matrix":
      return {
        id: quizItem.id,
        type: "matrix",
        order: quizItem.order,
      } satisfies PublicSpecQuizItemMatrix
    case "timeline":
      return {
        id: quizItem.id,
        type: "timeline",
        events: quizItem.timelineItemEvents,
        order: quizItem.order,
        timelineItems: quizItem.timelineItems,
      } satisfies PublicSpecQuizItemTimeline
    case "clickable-multiple-choice":
      return {
        id: quizItem.id,
        type: "choose-n",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        options: quizItem.options,
        n: CHOOSE_N_DEFAULT_VALUE,
      } satisfies PublicSpecQuizItemChooseN
    case "multiple-choice-dropdown":
      return {
        id: quizItem.id,
        type: "multiple-choice-dropdown",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        options: quizItem.options,
      } satisfies PublicSpecQuizItemMultiplechoiceDropdown
  }
}

const migratePublicSpecQuiz = (oldPublicSpecQuiz: PublicQuiz | null): PublicSpecQuiz | null => {
  if (oldPublicSpecQuiz === null) {
    return null
  }
  const PublicSpecQuiz: PublicSpecQuiz = {
    version: "2",
    id: oldPublicSpecQuiz.id,
    body: oldPublicSpecQuiz.body,
    items: [],
    title: oldPublicSpecQuiz.title,
  }
  oldPublicSpecQuiz.items.forEach((quizItem) => {
    PublicSpecQuiz.items.push(migratePublicSpecQuizItem(quizItem))
  })
  return PublicSpecQuiz
}

export default migratePublicSpecQuiz
