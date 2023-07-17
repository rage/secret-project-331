import { OldQuizItemType } from "../../../types/quizTypes/oldQuizTypes"
import {
  PublicQuizItemOption,
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
        optionDisplayDirection: quizItem.direction == "column" ? "horizontal" : "vertical",
        multipleChoiceMultipleOptionsGradingPolicy:
          quizItem.multipleChoiceMultipleOptionsGradingPolicy,
        options: quizItem.options.map(
          (option) =>
            ({
              body: option.body,
              id: option.id,
              order: option.order,
              title: option.title ?? "",
            } satisfies PublicQuizItemOption),
        ),
        order: quizItem.order,
        shuffleOptions: quizItem.shuffleOptions,
        title: quizItem.title,
      } satisfies PublicSpecQuizItemMultiplechoice
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
        optionAnswers: [],
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
        events: quizItem.timelineItemEvents.map((event) => ({
          eventId: event.id,
          name: event.name,
        })),
        order: quizItem.order,
        timelineItems: quizItem.timelineItems.map((item) => ({
          itemId: item.id,
          year: item.year,
        })),
      } satisfies PublicSpecQuizItemTimeline
    case "clickable-multiple-choice":
      return {
        id: quizItem.id,
        type: "choose-n",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        options: quizItem.options.map((option) => ({
          body: option.body,
          id: option.id,
          order: option.order,
          title: option.title ?? "",
        })),
        n: CHOOSE_N_DEFAULT_VALUE,
      } satisfies PublicSpecQuizItemChooseN
    case "multiple-choice-dropdown":
      return {
        id: quizItem.id,
        type: "multiple-choice-dropdown",
        order: quizItem.order,
        body: quizItem.body,
        title: quizItem.title,
        options: quizItem.options.map((option) => ({
          body: option.body,
          id: option.id,
          order: option.order,
          title: option.title ?? "",
        })),
      } satisfies PublicSpecQuizItemMultiplechoiceDropdown
  }
}

const migratePublicSpecQuiz = (oldPublicSpecQuiz: PublicQuiz): PublicSpecQuiz => {
  const PublicSpecQuiz: PublicSpecQuiz = {
    version: "2",
    body: oldPublicSpecQuiz.body,
    items: [],
    title: oldPublicSpecQuiz.title,
    quizItemDisplayDirection: oldPublicSpecQuiz.direction == "row" ? "horizontal" : "vertical",
  }
  oldPublicSpecQuiz.items.forEach((quizItem) => {
    PublicSpecQuiz.items.push(migratePublicSpecQuizItem(quizItem))
  })
  return PublicSpecQuiz
}

export default migratePublicSpecQuiz
