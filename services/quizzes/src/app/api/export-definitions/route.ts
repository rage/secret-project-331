import { NextResponse } from "next/server"

import {
  PrivateSpecQuiz,
  PrivateSpecQuizItem,
  QuizItemType,
} from "../../../../types/quizTypes/privateSpec"
import { handlePrivateSpecMigration } from "../../../grading/utils"
import {
  CsvExportColumn,
  CsvScalar,
  getAllowSelectingMultipleOptions,
  getChooseN,
  getCorrectOptionIds,
  getCorrectOptionTitles,
  getFormatRegex,
  getItemBody,
  getItemTitle,
  getMatrixCellColumns,
  getMatrixCellValue,
  getMatrixDimensions,
  getMaxTimelineItemCount,
  getMaxWords,
  getMinWords,
  getOptionIds,
  getOptionTitles,
  getQuizItemTypes,
  getScaleMaxLabel,
  getScaleMaxValue,
  getScaleMinLabel,
  getScaleMinValue,
  getSortedTimelineItems,
  getValidityRegex,
  joinValues,
  MATRIX_MAX_SIZE,
  matrixToHumanReadable,
  mergeColumns,
} from "../csv-export-utils"

interface CsvExportResult {
  rows: Array<Record<string, CsvScalar>>
}

interface CsvExportResponse {
  columns: CsvExportColumn[]
  results: CsvExportResult[]
}

interface CsvExportDefinitionsRequestItem {
  private_spec: unknown
}

interface CsvExportDefinitionsRequest {
  items: CsvExportDefinitionsRequestItem[]
}

const COMMON_DEFINITION_COLUMNS: CsvExportColumn[] = [
  { key: "quiz_title", header: "Quiz title" },
  { key: "quiz_item_id", header: "Quiz item id" },
  { key: "quiz_item_order", header: "Quiz item order" },
  { key: "quiz_item_type", header: "Quiz item type" },
  { key: "quiz_item_title", header: "Quiz item title" },
  { key: "quiz_item_body", header: "Quiz item body" },
]

const OPTION_DEFINITION_COLUMNS: CsvExportColumn[] = [
  { key: "option_count", header: "Option count" },
  { key: "option_ids", header: "Option ids" },
  { key: "option_titles", header: "Option titles" },
  { key: "correct_option_ids", header: "Correct option ids" },
  { key: "correct_option_titles", header: "Correct option titles" },
]

const MULTIPLE_CHOICE_DEFINITION_COLUMNS: CsvExportColumn[] = [
  ...OPTION_DEFINITION_COLUMNS,
  {
    key: "allow_selecting_multiple_options",
    header: "Allow selecting multiple options",
  },
]

const CHOOSE_N_DEFINITION_COLUMNS: CsvExportColumn[] = [
  ...OPTION_DEFINITION_COLUMNS,
  { key: "choose_n", header: "Choose N value" },
]

const ESSAY_DEFINITION_COLUMNS: CsvExportColumn[] = [
  { key: "min_words", header: "Minimum words" },
  { key: "max_words", header: "Maximum words" },
]

const SCALE_DEFINITION_COLUMNS: CsvExportColumn[] = [
  { key: "scale_min_value", header: "Scale minimum value" },
  { key: "scale_max_value", header: "Scale maximum value" },
  { key: "scale_min_label", header: "Scale minimum label" },
  { key: "scale_max_label", header: "Scale maximum label" },
]

const CLOSED_ENDED_QUESTION_DEFINITION_COLUMNS: CsvExportColumn[] = [
  { key: "validity_regex", header: "Validity regex" },
  { key: "format_regex", header: "Format regex" },
]

const MATRIX_DEFINITION_COLUMNS: CsvExportColumn[] = [
  { key: "matrix_active_rows", header: "Matrix active rows" },
  { key: "matrix_active_columns", header: "Matrix active columns" },
  { key: "matrix_summary", header: "Matrix summary" },
  ...getMatrixCellColumns(),
]

function parseRequest(body: unknown): CsvExportDefinitionsRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }
  if (!Array.isArray((body as Record<string, unknown>).items)) {
    throw new Error("Invalid request body: items must be an array")
  }
  return body as CsvExportDefinitionsRequest
}

function getOptionCount(item: PrivateSpecQuizItem): number | null {
  if ("options" in item && Array.isArray(item.options)) {
    return item.options.length
  }
  return null
}

function getTimelineDefinitionColumns(maxTimelineItemCount: number): CsvExportColumn[] {
  const columns: CsvExportColumn[] = [
    { key: "timeline_item_count", header: "Timeline item count" },
    { key: "timeline_summary", header: "Timeline summary" },
  ]

  for (let index = 0; index < maxTimelineItemCount; index += 1) {
    const itemNumber = index + 1
    columns.push(
      {
        key: `timeline_item_${itemNumber}_year`,
        header: `Timeline item ${itemNumber} year`,
      },
      {
        key: `timeline_item_${itemNumber}_correct_event`,
        header: `Timeline item ${itemNumber} correct event`,
      },
    )
  }

  return columns
}

function getTypeSpecificDefinitionColumns(
  type: QuizItemType,
  privateSpecQuiz: PrivateSpecQuiz,
): CsvExportColumn[] {
  switch (type) {
    case "multiple-choice":
      return MULTIPLE_CHOICE_DEFINITION_COLUMNS
    case "choose-n":
      return CHOOSE_N_DEFINITION_COLUMNS
    case "multiple-choice-dropdown":
      return OPTION_DEFINITION_COLUMNS
    case "essay":
      return ESSAY_DEFINITION_COLUMNS
    case "scale":
      return SCALE_DEFINITION_COLUMNS
    case "closed-ended-question":
      return CLOSED_ENDED_QUESTION_DEFINITION_COLUMNS
    case "matrix":
      return MATRIX_DEFINITION_COLUMNS
    case "timeline":
      return getTimelineDefinitionColumns(getMaxTimelineItemCount(privateSpecQuiz))
    case "checkbox":
    default:
      return []
  }
}

function getDefinitionColumns(privateSpecQuiz: PrivateSpecQuiz): CsvExportColumn[] {
  return mergeColumns([
    COMMON_DEFINITION_COLUMNS,
    ...getQuizItemTypes(privateSpecQuiz).map((type) =>
      getTypeSpecificDefinitionColumns(type, privateSpecQuiz),
    ),
  ])
}

function buildDefinitionRow(
  privateSpecQuiz: PrivateSpecQuiz,
  quizItem: PrivateSpecQuizItem,
): Record<string, CsvScalar> {
  const baseRow: Record<string, CsvScalar> = {
    quiz_title: privateSpecQuiz.title ?? null,
    quiz_item_id: quizItem.id,
    quiz_item_order: quizItem.order,
    quiz_item_type: quizItem.type,
    quiz_item_title: getItemTitle(quizItem),
    quiz_item_body: getItemBody(quizItem),
  }

  switch (quizItem.type) {
    case "multiple-choice":
      return {
        ...baseRow,
        option_count: getOptionCount(quizItem),
        option_ids: getOptionIds(quizItem),
        option_titles: getOptionTitles(quizItem),
        correct_option_ids: getCorrectOptionIds(quizItem),
        correct_option_titles: getCorrectOptionTitles(quizItem),
        allow_selecting_multiple_options: getAllowSelectingMultipleOptions(quizItem),
      }
    case "choose-n":
      return {
        ...baseRow,
        option_count: getOptionCount(quizItem),
        option_ids: getOptionIds(quizItem),
        option_titles: getOptionTitles(quizItem),
        correct_option_ids: getCorrectOptionIds(quizItem),
        correct_option_titles: getCorrectOptionTitles(quizItem),
        choose_n: getChooseN(quizItem),
      }
    case "multiple-choice-dropdown":
      return {
        ...baseRow,
        option_count: getOptionCount(quizItem),
        option_ids: getOptionIds(quizItem),
        option_titles: getOptionTitles(quizItem),
        correct_option_ids: getCorrectOptionIds(quizItem),
        correct_option_titles: getCorrectOptionTitles(quizItem),
      }
    case "essay":
      return {
        ...baseRow,
        min_words: getMinWords(quizItem),
        max_words: getMaxWords(quizItem),
      }
    case "scale":
      return {
        ...baseRow,
        scale_min_value: getScaleMinValue(quizItem),
        scale_max_value: getScaleMaxValue(quizItem),
        scale_min_label: getScaleMinLabel(quizItem),
        scale_max_label: getScaleMaxLabel(quizItem),
      }
    case "closed-ended-question":
      return {
        ...baseRow,
        validity_regex: getValidityRegex(quizItem),
        format_regex: getFormatRegex(quizItem),
      }
    case "matrix": {
      const matrixDimensions = getMatrixDimensions(quizItem.optionCells)
      const row: Record<string, CsvScalar> = {
        ...baseRow,
        matrix_active_rows: matrixDimensions.rowCount,
        matrix_active_columns: matrixDimensions.columnCount,
        matrix_summary: matrixToHumanReadable(quizItem.optionCells),
      }

      for (let rowIndex = 0; rowIndex < MATRIX_MAX_SIZE; rowIndex += 1) {
        for (let columnIndex = 0; columnIndex < MATRIX_MAX_SIZE; columnIndex += 1) {
          row[`matrix_row_${rowIndex + 1}_column_${columnIndex + 1}`] = getMatrixCellValue(
            quizItem.optionCells,
            rowIndex,
            columnIndex,
          )
        }
      }

      return row
    }
    case "timeline": {
      const sortedTimelineItems = getSortedTimelineItems(quizItem)
      const row: Record<string, CsvScalar> = {
        ...baseRow,
        timeline_item_count: sortedTimelineItems.length,
        timeline_summary: joinValues(
          sortedTimelineItems.map(
            (timelineItem) => `${timelineItem.year}: ${timelineItem.correctEventName}`,
          ),
        ),
      }

      for (let index = 0; index < sortedTimelineItems.length; index += 1) {
        const timelineItem = sortedTimelineItems[index]
        row[`timeline_item_${index + 1}_year`] = timelineItem.year
        row[`timeline_item_${index + 1}_correct_event`] = timelineItem.correctEventName
      }

      return row
    }
    case "checkbox":
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
        ? mergeColumns(migratedPrivateSpecs.map((ps) => getDefinitionColumns(ps)))
        : COMMON_DEFINITION_COLUMNS

    const response: CsvExportResponse = {
      columns,
      results: migratedPrivateSpecs.map((privateSpecQuiz) => {
        return {
          rows: privateSpecQuiz.items.map((quizItem) =>
            buildDefinitionRow(privateSpecQuiz, quizItem),
          ),
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
