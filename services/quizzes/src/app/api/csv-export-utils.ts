import { UserItemAnswer } from "../../../types/quizTypes/answer"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItem,
  PrivateSpecQuizItemTimelineItem,
  QuizItemOption,
  QuizItemType,
} from "../../../types/quizTypes/privateSpec"

export type CsvScalar = string | number | boolean | null

export interface CsvExportColumn {
  key: string
  header: string
}

export const MATRIX_MAX_SIZE = 6

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

/** Joins values with " | "; avoids semicolon/comma so Office treats the cell as one column. */
export function joinValues(values: string[]): string | null {
  if (values.length === 0) {
    return null
  }
  return values.join(" | ")
}

function isNonEmptyMatrixCell(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== ""
}

/** Returns unique quiz item types in order of first appearance. */
export function getQuizItemTypes(privateSpecQuiz: PrivateSpecQuiz): QuizItemType[] {
  const seen = new Set<QuizItemType>()
  const types: QuizItemType[] = []

  for (const quizItem of privateSpecQuiz.items) {
    if (!seen.has(quizItem.type)) {
      seen.add(quizItem.type)
      types.push(quizItem.type)
    }
  }

  return types
}

/** Merges column arrays by key; first occurrence wins, order preserved. */
export function mergeColumns(columnSets: CsvExportColumn[][]): CsvExportColumn[] {
  const mergedColumns: CsvExportColumn[] = []
  const seenKeys = new Set<string>()

  for (const columnSet of columnSets) {
    for (const column of columnSet) {
      if (!seenKeys.has(column.key)) {
        seenKeys.add(column.key)
        mergedColumns.push(column)
      }
    }
  }

  return mergedColumns
}

/** Returns non-empty row/column counts or null if matrix empty. */
export function getMatrixDimensions(matrix: string[][] | null | undefined): {
  rowCount: number | null
  columnCount: number | null
} {
  if (!matrix) {
    return { rowCount: null, columnCount: null }
  }

  let maxRowIndex = -1
  let maxColumnIndex = -1

  for (let rowIndex = 0; rowIndex < MATRIX_MAX_SIZE; rowIndex += 1) {
    const row = matrix[rowIndex] ?? []
    for (let columnIndex = 0; columnIndex < MATRIX_MAX_SIZE; columnIndex += 1) {
      if (isNonEmptyMatrixCell(row[columnIndex])) {
        maxRowIndex = Math.max(maxRowIndex, rowIndex)
        maxColumnIndex = Math.max(maxColumnIndex, columnIndex)
      }
    }
  }

  if (maxRowIndex === -1 || maxColumnIndex === -1) {
    return { rowCount: null, columnCount: null }
  }

  return {
    rowCount: maxRowIndex + 1,
    columnCount: maxColumnIndex + 1,
  }
}

/** Returns trimmed cell value or null if missing/empty. */
export function getMatrixCellValue(
  matrix: string[][] | null | undefined,
  rowIndex: number,
  columnIndex: number,
): string | null {
  const value = matrix?.[rowIndex]?.[columnIndex]
  if (!isNonEmptyMatrixCell(value)) {
    return null
  }
  return value.trim()
}

/** Returns column definitions for all matrix cells up to MATRIX_MAX_SIZE. */
export function getMatrixCellColumns(prefix = "matrix"): CsvExportColumn[] {
  const columns: CsvExportColumn[] = []

  for (let rowIndex = 0; rowIndex < MATRIX_MAX_SIZE; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < MATRIX_MAX_SIZE; columnIndex += 1) {
      const rowNumber = rowIndex + 1
      const columnNumber = columnIndex + 1
      columns.push({
        key: `${prefix}_row_${rowNumber}_column_${columnNumber}`,
        header: `Matrix row ${rowNumber} column ${columnNumber}`,
      })
    }
  }

  return columns
}

/** Returns human-readable matrix string with distinct cell/row separators, or null if empty. */
export function matrixToHumanReadable(matrix: string[][] | null | undefined): string | null {
  const { rowCount, columnCount } = getMatrixDimensions(matrix)
  if (!rowCount || !columnCount) {
    return null
  }

  const formattedRows: string[] = []

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowValues: string[] = []

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      rowValues.push(getMatrixCellValue(matrix, rowIndex, columnIndex) ?? "")
    }

    formattedRows.push(rowValues.join(" | "))
  }

  return formattedRows.join(" / ")
}

/** Returns timeline items sorted by year (numeric then string). */
export function getSortedTimelineItems(
  quizItem: PrivateSpecQuizItem | null,
): PrivateSpecQuizItemTimelineItem[] {
  if (quizItem?.type !== "timeline" || !quizItem.timelineItems) {
    return []
  }

  return [...quizItem.timelineItems].sort((left, right) => {
    const leftNumber = Number(left.year)
    const rightNumber = Number(right.year)
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber
    }
    return left.year.localeCompare(right.year)
  })
}

/** Returns max number of timeline items across all timeline quiz items. */
export function getMaxTimelineItemCount(privateSpecQuiz: PrivateSpecQuiz): number {
  return privateSpecQuiz.items.reduce((maxCount, quizItem) => {
    return Math.max(maxCount, getSortedTimelineItems(quizItem).length)
  }, 0)
}

/** Returns quiz item by id or null if not found. */
export function getQuizItemById(
  privateSpecQuiz: PrivateSpecQuiz,
  quizItemId: string,
): PrivateSpecQuizItem | null {
  return privateSpecQuiz.items.find((quizItem) => quizItem.id === quizItemId) ?? null
}

/** Returns item title if present, else null. */
export function getItemTitle(item: PrivateSpecQuizItem): string | null {
  if ("title" in item) {
    return item.title ?? null
  }
  return null
}

/** Returns item body if present, else null. */
export function getItemBody(item: PrivateSpecQuizItem): string | null {
  if ("body" in item) {
    return item.body ?? null
  }
  return null
}

/** Returns option ids joined with " | " or null if no options. */
export function getOptionIds(item: PrivateSpecQuizItem): string | null {
  return joinValues((getOptions(item) ?? []).map((option) => option.id))
}

/** Returns option titles/labels joined with " | " or null if no options. */
export function getOptionTitles(item: PrivateSpecQuizItem): string | null {
  return joinValues((getOptions(item) ?? []).map(getOptionLabel))
}

/** Returns correct option ids joined with " | " or null if no options. */
export function getCorrectOptionIds(item: PrivateSpecQuizItem): string | null {
  return joinValues(
    (getOptions(item) ?? []).filter((option) => option.correct).map((option) => option.id),
  )
}

/** Returns correct option titles joined with " | " or null if no options. */
export function getCorrectOptionTitles(item: PrivateSpecQuizItem): string | null {
  return joinValues(
    (getOptions(item) ?? [])
      .filter((option) => option.correct)
      .map((option) => getOptionLabel(option)),
  )
}

/** Returns allowSelectingMultipleOptions for multiple-choice, else null. */
export function getAllowSelectingMultipleOptions(item: PrivateSpecQuizItem): boolean | null {
  if (item.type !== "multiple-choice") {
    return null
  }
  return item.allowSelectingMultipleOptions
}

/** Returns n (number to choose) for choose-n, else null. */
export function getChooseN(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "choose-n") {
    return null
  }
  return item.n
}

/** Returns minWords for essay, else null. */
export function getMinWords(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "essay") {
    return null
  }
  return item.minWords
}

/** Returns maxWords for essay, else null. */
export function getMaxWords(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "essay") {
    return null
  }
  return item.maxWords
}

/** Returns minValue for scale, else null. */
export function getScaleMinValue(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "scale") {
    return null
  }
  return item.minValue
}

/** Returns maxValue for scale, else null. */
export function getScaleMaxValue(item: PrivateSpecQuizItem): number | null {
  if (item.type !== "scale") {
    return null
  }
  return item.maxValue
}

/** Returns minLabel for scale, else null. */
export function getScaleMinLabel(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "scale") {
    return null
  }
  return item.minLabel ?? null
}

/** Returns maxLabel for scale, else null. */
export function getScaleMaxLabel(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "scale") {
    return null
  }
  return item.maxLabel ?? null
}

/** Returns validityRegex for closed-ended-question, else null. */
export function getValidityRegex(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "closed-ended-question") {
    return null
  }
  return item.validityRegex ?? null
}

/** Returns formatRegex for closed-ended-question, else null. */
export function getFormatRegex(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "closed-ended-question") {
    return null
  }
  return item.formatRegex ?? null
}

/** Returns JSON string of timeline items for timeline type, else null. */
export function getTimelineItemsJson(item: PrivateSpecQuizItem): string | null {
  if (item.type !== "timeline" || !item.timelineItems) {
    return null
  }
  return JSON.stringify(item.timelineItems)
}

/** Returns JSON string of optionCells for matrix type, else null. */
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

/** Returns selected option ids joined with " | " for choice types, else null. */
export function getSelectedOptionIds(itemAnswer: UserItemAnswer): string | null {
  return joinValues(getSelectedOptionIdsFromAnswer(itemAnswer) ?? [])
}

/** Returns selected option titles (or ids if option missing) joined with " | " for choice types, else null. */
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

/** Returns "correct"/"incorrect"/"unknown" for selected options joined with " | ", else null. */
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

/** Returns human-readable answer value per item type (titles, text, scale value, etc.) or null. */
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
