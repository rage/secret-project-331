import { UserItemAnswer } from "../../../types/quizTypes/answer"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItem,
  QuizItemOption,
} from "../../../types/quizTypes/privateSpec"

function getOptions(quizItem: PrivateSpecQuizItem | null): QuizItemOption[] | null {
  if (!quizItem) {
    return null
  }

  switch (quizItem.type) {
    case "multiple-choice":
    case "choose-n":
    case "multiple-choice-dropdown":
      return quizItem.options
    default:
      return null
  }
}

function getOptionLabel(option: QuizItemOption): string {
  return option.title ?? option.body ?? option.id
}

function joinValues(values: string[]): string | null {
  if (values.length === 0) {
    return null
  }
  return values.join("; ")
}

function matrixToHumanReadable(matrix: string[][]): string {
  return matrix.map((row) => row.join(", ")).join(" | ")
}

export function getQuizItemById(
  privateSpecQuiz: PrivateSpecQuiz,
  quizItemId: string,
): PrivateSpecQuizItem | null {
  return privateSpecQuiz.items.find((quizItem) => quizItem.id === quizItemId) ?? null
}

export function getItemTitle(item: PrivateSpecQuizItem): string | null {
  if ("title" in item) {
    return item.title ?? null
  }
  return null
}

export function getItemBody(item: PrivateSpecQuizItem): string | null {
  if ("body" in item) {
    return item.body ?? null
  }
  return null
}

export function getOptionIds(item: PrivateSpecQuizItem): string | null {
  return joinValues((getOptions(item) ?? []).map((option) => option.id))
}

export function getOptionTitles(item: PrivateSpecQuizItem): string | null {
  return joinValues((getOptions(item) ?? []).map(getOptionLabel))
}

export function getCorrectOptionIds(item: PrivateSpecQuizItem): string | null {
  return joinValues(
    (getOptions(item) ?? []).filter((option) => option.correct).map((option) => option.id),
  )
}

export function getCorrectOptionTitles(item: PrivateSpecQuizItem): string | null {
  return joinValues(
    (getOptions(item) ?? [])
      .filter((option) => option.correct)
      .map((option) => getOptionLabel(option)),
  )
}

export function getAllowSelectingMultipleOptions(item: PrivateSpecQuizItem): boolean | null {
  if (item.type !== "multiple-choice") {
    return null
  }
  return item.allowSelectingMultipleOptions
}

export function getChooseN(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "choose-n") {
    return null
  }
  return item.n
}

export function getMinWords(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "essay") {
    return null
  }
  return item.minWords
}

export function getMaxWords(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "essay") {
    return null
  }
  return item.maxWords
}

export function getScaleMinValue(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "scale") {
    return null
  }
  return item.minValue
}

export function getScaleMaxValue(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "scale") {
    return null
  }
  return item.maxValue
}

export function getScaleMinLabel(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "scale") {
    return null
  }
  return item.minLabel ?? null
}

export function getScaleMaxLabel(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "scale") {
    return null
  }
  return item.maxLabel ?? null
}

export function getValidityRegex(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "closed-ended-question") {
    return null
  }
  return item.validityRegex ?? null
}

export function getFormatRegex(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "closed-ended-question") {
    return null
  }
  return item.formatRegex ?? null
}

export function getTimelineItemsJson(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "timeline" || !item.timelineItems) {
    return null
  }
  return JSON.stringify(item.timelineItems)
}

export function getMatrixOptionCellsJson(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "matrix" || !item.optionCells) {
    return null
  }
  return JSON.stringify(item.optionCells)
}

function getSelectedOptionIdsFromAnswer(itemAnswer: UserItemAnswer): string[] | null {
  switch (itemAnswer.type) {
    case "multiple-choice":
    case "choose-n":
    case "multiple-choice-dropdown":
      return itemAnswer.selectedOptionIds
    default:
      return null
  }
}

export function getSelectedOptionIds(itemAnswer: UserItemAnswer): string | null {
  return joinValues(getSelectedOptionIdsFromAnswer(itemAnswer) ?? [])
}

export function getSelectedOptionTitles(
  itemAnswer: UserItemAnswer,
  quizItem: PrivateSpecQuizItem | null,
): string | null {
  const selectedOptionIds = getSelectedOptionIdsFromAnswer(itemAnswer)
  const options = getOptions(quizItem)
  if (!selectedOptionIds || !options) {
    return null
  }

  const optionById = new Map(options.map((option) => [option.id, option]))
  return joinValues(
    selectedOptionIds.map((optionId) => {
      const option = optionById.get(optionId)
      return option ? getOptionLabel(option) : optionId
    }),
  )
}

export function getSelectedOptionCorrectness(
  itemAnswer: UserItemAnswer,
  quizItem: PrivateSpecQuizItem | null,
): string | null {
  const selectedOptionIds = getSelectedOptionIdsFromAnswer(itemAnswer)
  const options = getOptions(quizItem)
  if (!selectedOptionIds || !options) {
    return null
  }

  const optionById = new Map(options.map((option) => [option.id, option]))
  return joinValues(
    selectedOptionIds.map((optionId) => {
      const option = optionById.get(optionId)
      if (!option) {
        return "unknown"
      }
      return option.correct ? "correct" : "incorrect"
    }),
  )
}

export function getHumanReadableAnswerValue(
  itemAnswer: UserItemAnswer,
  quizItem: PrivateSpecQuizItem | null,
): string | number | boolean | null {
  switch (itemAnswer.type) {
    case "multiple-choice":
    case "choose-n":
    case "multiple-choice-dropdown":
      return getSelectedOptionTitles(itemAnswer, quizItem) ?? getSelectedOptionIds(itemAnswer)
    case "essay":
      return itemAnswer.textData
    case "scale":
      return itemAnswer.intData
    case "checkbox":
      return itemAnswer.checked
    case "closed-ended-question":
      return itemAnswer.textData
    case "matrix":
      return matrixToHumanReadable(itemAnswer.matrix)
    case "timeline": {
      if (quizItem?.type !== "timeline" || !quizItem.timelineItems) {
        return JSON.stringify(itemAnswer.timelineChoices)
      }

      const timelineItemById = new Map(
        quizItem.timelineItems.map((timelineItem) => [timelineItem.id, timelineItem]),
      )
      const eventNameById = new Map(
        quizItem.timelineItems.map((timelineItem) => [
          timelineItem.correctEventId,
          timelineItem.correctEventName,
        ]),
      )

      return joinValues(
        itemAnswer.timelineChoices.map((timelineChoice) => {
          const timelineItem = timelineItemById.get(timelineChoice.timelineItemId)
          const eventName =
            eventNameById.get(timelineChoice.chosenEventId) ?? timelineChoice.chosenEventId
          const year = timelineItem?.year ?? timelineChoice.timelineItemId
          return `${year}: ${eventName}`
        }),
      )
    }
  }
}
