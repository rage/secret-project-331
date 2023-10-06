import { v4 } from "uuid"

import {
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

  const item = quiz.items.find((item) => item.id === quizItemId)
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
        body: "",
        failureMessage: "",
        order: 0,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemCheckbox
    case "choose-n":
      return {
        type,
        id: v4(),
        failureMessage: "",
        options: [],
        order: 0,
        successMessage: "",
        title: "",
        body: "",
        n: 2,
      } as PrivateSpecQuizItemChooseN
    case "closed-ended-question":
      return {
        type,
        id: v4(),
        body: "",
        failureMessage: "",
        formatRegex: "",
        order: 0,
        successMessage: "",
        title: "",
        validityRegex: "",
      } as PrivateSpecQuizItemClosedEndedQuestion
    case "essay":
      return {
        type,
        id: v4(),
        body: "",
        failureMessage: "",
        maxWords: 150,
        minWords: 0,
        order: 0,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemEssay
    case "matrix":
      return {
        type,
        id: v4(),
        optionCells: createEmptyMatrix(),
        order: 0,
        successMessage: "",
        failureMessage: "",
      } as PrivateSpecQuizItemMatrix
    case "multiple-choice":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: true,
        body: "",
        // eslint-disable-next-line i18next/no-literal-string
        optionDisplayDirection: "vertical",
        failureMessage: "",
        // eslint-disable-next-line i18next/no-literal-string
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        options: [],
        order: 0,
        sharedOptionFeedbackMessage: "",
        shuffleOptions: false,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemMultiplechoice
    case "multiple-choice-dropdown":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: true,
        body: "",
        // eslint-disable-next-line i18next/no-literal-string
        direction: "row",
        failureMessage: "",
        // eslint-disable-next-line i18next/no-literal-string
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        options: [],
        order: 0,
        sharedOptionFeedbackMessage: "",
        shuffleOptions: false,
        successMessage: "",
        title: "",
      } as PrivateSpecQuizItemMultiplechoiceDropdown
    case "scale":
      return {
        type,
        id: v4(),
        failureMessage: "",
        maxLabel: "",
        maxValue: 5,
        minLabel: "",
        minValue: 0,
        order: 0,
        successMessage: "",
        title: "",
        body: "",
      } as PrivateSpecQuizItemScale
    case "timeline":
      return {
        events: [],
        type,
        id: v4(),
        failureMessage: "",
        order: 0,
        successMessage: "",
        timelineItems: [],
      } as PrivateSpecQuizItemTimeline
  }
}

export default findQuizItem
export { createEmptyQuizItem }
