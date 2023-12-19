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
        body: null,
        failureMessage: null,
        order: 0,
        successMessage: null,
        title: null,
      } as PrivateSpecQuizItemCheckbox
    case "choose-n":
      return {
        type,
        id: v4(),
        failureMessage: null,
        order: 0,
        successMessage: null,
        title: null,
        body: null,
        n: 2,
        options: [],
        messageOnModelSolution: null,
      } as PrivateSpecQuizItemChooseN
    case "closed-ended-question":
      return {
        type,
        id: v4(),
        body: null,
        failureMessage: null,
        formatRegex: null,
        order: 0,
        successMessage: null,
        title: null,
        validityRegex: null,
      } as PrivateSpecQuizItemClosedEndedQuestion
    case "essay":
      return {
        type,
        id: v4(),
        body: null,
        failureMessage: null,
        maxWords: 150,
        minWords: 0,
        order: 0,
        successMessage: null,
        title: null,
      } as PrivateSpecQuizItemEssay
    case "matrix":
      return {
        type,
        id: v4(),
        optionCells: createEmptyMatrix(),
        order: 0,
        successMessage: null,
        failureMessage: null,
      } as PrivateSpecQuizItemMatrix
    case "multiple-choice":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: false,
        body: null,
        optionDisplayDirection: "vertical",
        failureMessage: null,
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        order: 0,
        sharedOptionFeedbackMessage: null,
        shuffleOptions: false,
        successMessage: null,
        title: null,
        fogOfWar: false,
        options: [],
        messageOnModelSolution: null,
      } as PrivateSpecQuizItemMultiplechoice
    case "multiple-choice-dropdown":
      return {
        type,
        id: v4(),
        allowSelectingMultipleOptions: false,
        body: null,
        direction: "row",
        failureMessage: null,
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        order: 0,
        sharedOptionFeedbackMessage: null,
        shuffleOptions: false,
        successMessage: null,
        title: null,
        options: [],
        messageOnModelSolution: null,
      } as PrivateSpecQuizItemMultiplechoiceDropdown
    case "scale":
      return {
        type,
        id: v4(),
        failureMessage: null,
        maxLabel: null,
        maxValue: 5,
        minLabel: null,
        minValue: 0,
        order: 0,
        successMessage: null,
        title: null,
        body: null,
      } as PrivateSpecQuizItemScale
    case "timeline":
      return {
        events: [],
        type,
        id: v4(),
        failureMessage: null,
        order: 0,
        successMessage: null,
        timelineItems: [],
        messageOnModelSolution: null,
      } as PrivateSpecQuizItemTimeline
  }
}

export default findQuizItem
export { createEmptyQuizItem }
