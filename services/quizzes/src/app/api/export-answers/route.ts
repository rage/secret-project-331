import { NextResponse } from "next/server"

import { UserAnswer, UserItemAnswer } from "../../../../types/quizTypes/answer"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItem,
  QuizItemType,
} from "../../../../types/quizTypes/privateSpec"
import { handlePrivateSpecMigration, handleUserAnswerMigration } from "../../../grading/utils"
import {
  CsvExportColumn,
  CsvScalar,
  getItemBody,
  getMatrixCellColumns,
  getMatrixCellValue,
  getMaxTimelineItemCount,
  getQuizItemById,
  getQuizItemTypes,
  getSelectedOptionIds,
  getSelectedOptionTitles,
  getSortedTimelineItems,
  MATRIX_MAX_SIZE,
  mergeColumns,
} from "../csv-export-utils"

interface CsvExportResult {
  rows: Array<Record<string, CsvScalar>>
}

interface CsvExportResponse {
  columns: CsvExportColumn[]
  results: CsvExportResult[]
}

interface CsvExportAnswersRequestItem {
  private_spec: unknown
  answer: unknown
  grading: unknown
  model_solution_spec: unknown
}

interface CsvExportAnswersRequest {
  items: CsvExportAnswersRequestItem[]
}

const COMMON_ANSWER_COLUMNS: CsvExportColumn[] = [
  { key: "quiz_item_id", header: "Quiz item id" },
  { key: "quiz_item_body", header: "Quiz item body" },
  { key: "score_given", header: "Score given" },
]

const OPTION_ANSWER_COLUMNS: CsvExportColumn[] = [
  { key: "selected_option_ids", header: "Selected option ids" },
  { key: "selected_option_titles", header: "Selected option titles" },
]

const TEXT_ANSWER_COLUMNS: CsvExportColumn[] = [{ key: "answer_text", header: "Answer text" }]

const SCALE_ANSWER_COLUMNS: CsvExportColumn[] = [
  { key: "selected_value", header: "Selected value" },
]

const CHECKBOX_ANSWER_COLUMNS: CsvExportColumn[] = [{ key: "checked", header: "Checked" }]

const MATRIX_ANSWER_COLUMNS: CsvExportColumn[] = getMatrixCellColumns()

function parseRequest(body: unknown): CsvExportAnswersRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }
  if (!Array.isArray((body as Record<string, unknown>).items)) {
    throw new Error("Invalid request body: items must be an array")
  }
  return body as CsvExportAnswersRequest
}

function getNumberField(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[key] === "number" ? (typedValue[key] as number) : null
}

function getTimelineAnswerColumns(maxTimelineItemCount: number): CsvExportColumn[] {
  const columns: CsvExportColumn[] = []

  for (let index = 0; index < maxTimelineItemCount; index += 1) {
    const itemNumber = index + 1
    columns.push(
      {
        key: `timeline_item_${itemNumber}_year`,
        header: `Timeline item ${itemNumber} year`,
      },
      {
        key: `timeline_item_${itemNumber}_selected_event`,
        header: `Timeline item ${itemNumber} selected event`,
      },
      {
        key: `timeline_item_${itemNumber}_was_correct`,
        header: `Timeline item ${itemNumber} was correct`,
      },
    )
  }

  return columns
}

function getTypeSpecificAnswerColumns(
  type: QuizItemType,
  privateSpecQuiz: PrivateSpecQuiz,
): CsvExportColumn[] {
  switch (type) {
    case "multiple-choice":
    case "choose-n":
    case "multiple-choice-dropdown":
      return OPTION_ANSWER_COLUMNS
    case "essay":
    case "closed-ended-question":
      return TEXT_ANSWER_COLUMNS
    case "scale":
      return SCALE_ANSWER_COLUMNS
    case "checkbox":
      return CHECKBOX_ANSWER_COLUMNS
    case "matrix":
      return MATRIX_ANSWER_COLUMNS
    case "timeline":
      return getTimelineAnswerColumns(getMaxTimelineItemCount(privateSpecQuiz))
    default:
      return []
  }
}

function getAnswerColumns(privateSpecQuiz: PrivateSpecQuiz): CsvExportColumn[] {
  return mergeColumns([
    COMMON_ANSWER_COLUMNS,
    ...getQuizItemTypes(privateSpecQuiz).map((type) =>
      getTypeSpecificAnswerColumns(type, privateSpecQuiz),
    ),
  ])
}

function buildCommonAnswerRow(
  itemAnswer: UserItemAnswer,
  quizItem: PrivateSpecQuizItem | null,
  scoreGiven: number | null,
): Record<string, CsvScalar> {
  return {
    quiz_item_id: itemAnswer.quizItemId,
    quiz_item_body: quizItem ? getItemBody(quizItem) : null,
    score_given: scoreGiven,
  }
}

function buildAnswerRow(
  itemAnswer: UserItemAnswer,
  quizItem: PrivateSpecQuizItem | null,
  scoreGiven: number | null,
): Record<string, CsvScalar> {
  const baseRow = buildCommonAnswerRow(itemAnswer, quizItem, scoreGiven)

  switch (itemAnswer.type) {
    case "multiple-choice":
    case "choose-n":
    case "multiple-choice-dropdown":
      return {
        ...baseRow,
        selected_option_ids: getSelectedOptionIds(itemAnswer),
        selected_option_titles: getSelectedOptionTitles(itemAnswer, quizItem),
      }
    case "essay":
      return {
        ...baseRow,
        answer_text: itemAnswer.textData,
      }
    case "scale":
      return {
        ...baseRow,
        selected_value: itemAnswer.intData,
      }
    case "checkbox":
      return {
        ...baseRow,
        checked: itemAnswer.checked,
      }
    case "closed-ended-question":
      return {
        ...baseRow,
        answer_text: itemAnswer.textData,
      }
    case "matrix": {
      const row: Record<string, CsvScalar> = { ...baseRow }

      for (let rowIndex = 0; rowIndex < MATRIX_MAX_SIZE; rowIndex += 1) {
        for (let columnIndex = 0; columnIndex < MATRIX_MAX_SIZE; columnIndex += 1) {
          row[`matrix_row_${rowIndex + 1}_column_${columnIndex + 1}`] = getMatrixCellValue(
            itemAnswer.matrix,
            rowIndex,
            columnIndex,
          )
        }
      }

      return row
    }
    case "timeline": {
      const sortedTimelineItems = getSortedTimelineItems(quizItem)
      const eventNameById = new Map(
        sortedTimelineItems.map((timelineItem) => [
          timelineItem.correctEventId,
          timelineItem.correctEventName,
        ]),
      )
      const timelineChoiceByItemId = new Map(
        itemAnswer.timelineChoices.map((timelineChoice) => [
          timelineChoice.timelineItemId,
          timelineChoice,
        ]),
      )
      const row: Record<string, CsvScalar> = { ...baseRow }

      for (let index = 0; index < sortedTimelineItems.length; index += 1) {
        const timelineItem = sortedTimelineItems[index]
        const timelineChoice = timelineChoiceByItemId.get(timelineItem.id)
        const selectedEventName = timelineChoice
          ? (eventNameById.get(timelineChoice.chosenEventId) ?? timelineChoice.chosenEventId)
          : null

        row[`timeline_item_${index + 1}_year`] = timelineItem.year
        row[`timeline_item_${index + 1}_selected_event`] = selectedEventName
        row[`timeline_item_${index + 1}_was_correct`] = timelineChoice
          ? timelineChoice.chosenEventId === timelineItem.correctEventId
          : null
      }

      return row
    }
    default:
      return baseRow
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = parseRequest(body)

    const migratedPrivateSpecs = parsed.items.map((item) =>
      handlePrivateSpecMigration(item.private_spec as PrivateSpecQuiz),
    )
    const columns =
      migratedPrivateSpecs.length > 0
        ? mergeColumns(migratedPrivateSpecs.map((ps) => getAnswerColumns(ps)))
        : COMMON_ANSWER_COLUMNS

    const response: CsvExportResponse = {
      columns,
      results: parsed.items.map((item, index) => {
        const privateSpecQuiz = migratedPrivateSpecs[index]
        const userAnswer = handleUserAnswerMigration(privateSpecQuiz, item.answer as UserAnswer)
        const scoreGiven = getNumberField(item.grading, "score_given")

        return {
          rows: userAnswer.itemAnswers.map((itemAnswer) => {
            const quizItem = getQuizItemById(privateSpecQuiz, itemAnswer.quizItemId)
            return buildAnswerRow(itemAnswer, quizItem, scoreGiven)
          }),
        }
      }),
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
  }
}

function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export const GET = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
export const OPTIONS = notFound
export const HEAD = notFound
