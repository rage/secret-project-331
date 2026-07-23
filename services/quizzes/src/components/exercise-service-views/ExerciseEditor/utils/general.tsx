/* oxlint-disable i18next/no-literal-string */
import { v4 } from "uuid"

import type {
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
  QuizItemType,
} from "../../../../../types/quizTypes/privateSpec"

/**
 * Find quiz item from quiz
 *
 * @param quiz PrivateSpecQuiz from which to search quiz item
 * @param quizItemId Id of the quiz item
 * @param quizItemType Quiz item type to be returned
 * @returns Found quiz item, null if it's not found
 */
const findQuizItem = <T,>(
  quiz: PrivateSpecQuiz | null,
  quizItemId: string,
  quizItemType: QuizItemType,
): T | null => {
  if (!quiz) {
    return null
  }

  const item = quiz.items.find((quizItem) => quizItem.id === quizItemId)
  if (!item) {
    return null
  }
  if (item.type === quizItemType) {
    return item as T
  }

  return null
}

const createEmptyMatrix = () => {
  const emptyMatrix: string[][] = []
  for (let i = 0; i < 6; i++) {
    const columnArray: string[] = []
    for (let j = 0; j < 6; j++) {
      columnArray.push("")
    }
    emptyMatrix.push(columnArray)
  }
  return emptyMatrix
}

const createEmptyQuizItem = (type: QuizItemType) => {
  switch (type) {
    case "checkbox":
      return {
        type,
        id: v4(),
        body: null,
        order: 0,
        title: null,
        feedbackMessages: [],
      } as PrivateSpecQuizItemCheckbox
    case "choose-n":
      return {
        type,
        id: v4(),
        order: 0,
        title: null,
        body: null,
        n: 2,
        options: [],
        feedbackMessages: [],
      } as PrivateSpecQuizItemChooseN
    case "closed-ended-question":
      return {
        type,
        id: v4(),
        body: null,
        formatRegex: null,
        gradingStrategy: null,
        order: 0,
        title: null,
        feedbackMessages: [],
      } as PrivateSpecQuizItemClosedEndedQuestion
    case "essay":
      return {
        type,
        id: v4(),
        body: null,
        maxWords: 150,
        minWords: 0,
        order: 0,
        title: null,
        feedbackMessages: [],
      } as PrivateSpecQuizItemEssay
    case "matrix":
      return {
        type,
        id: v4(),
        optionCells: createEmptyMatrix(),
        order: 0,
        feedbackMessages: [],
      } as PrivateSpecQuizItemMatrix
    case "multiple-choice":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: false,
        body: null,
        optionDisplayDirection: "vertical",
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        order: 0,
        shuffleOptions: false,
        title: null,
        fogOfWar: false,
        options: [],
        feedbackMessages: [],
      } as PrivateSpecQuizItemMultiplechoice
    case "multiple-choice-dropdown":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: false,
        body: null,
        direction: "row",
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        order: 0,
        shuffleOptions: false,
        title: null,
        options: [],
        feedbackMessages: [],
      } as PrivateSpecQuizItemMultiplechoiceDropdown
    case "scale":
      return {
        type,
        id: v4(),
        maxLabel: null,
        maxValue: 5,
        minLabel: null,
        minValue: 0,
        order: 0,
        title: null,
        body: null,
        feedbackMessages: [],
      } as PrivateSpecQuizItemScale
    case "timeline":
      return {
        events: [],
        type,
        id: v4(),
        order: 0,
        timelineItems: [],
        feedbackMessages: [],
      } as PrivateSpecQuizItemTimeline
  }
}

export default findQuizItem
export { createEmptyQuizItem }
