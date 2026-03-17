import { NextResponse } from "next/server"

import { PrivateSpecQuiz, PrivateSpecQuizItem } from "../../../../types/quizTypes/privateSpec"
import { handlePrivateSpecMigration } from "../../../grading/utils"
import {
  getAllowSelectingMultipleOptions,
  getChooseN,
  getCorrectOptionIds,
  getCorrectOptionTitles,
  getFormatRegex,
  getItemBody,
  getItemTitle,
  getMatrixOptionCellsJson,
  getMaxWords,
  getMinWords,
  getOptionIds,
  getOptionTitles,
  getScaleMaxLabel,
  getScaleMaxValue,
  getScaleMinLabel,
  getScaleMinValue,
  getTimelineItemsJson,
  getValidityRegex,
} from "../csv-export-utils"

type CsvScalar = string | number | boolean | null

interface CsvExportColumn {
  key: string
  header: string
}

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = parseRequest(body)

    const response: CsvExportResponse = {
      columns: [
        { key: "quiz_title", header: "Quiz title" },
        { key: "quiz_item_id", header: "Quiz item id" },
        { key: "quiz_item_order", header: "Quiz item order" },
        { key: "quiz_item_type", header: "Quiz item type" },
        { key: "quiz_item_title", header: "Quiz item title" },
        { key: "quiz_item_body", header: "Quiz item body" },
        { key: "option_count", header: "Option count" },
        { key: "option_ids", header: "Option ids" },
        { key: "option_titles", header: "Option titles" },
        { key: "correct_option_ids", header: "Correct option ids" },
        { key: "correct_option_titles", header: "Correct option titles" },
        {
          key: "allow_selecting_multiple_options",
          header: "Allow selecting multiple options",
        },
        { key: "choose_n", header: "Choose N value" },
        { key: "min_words", header: "Minimum words" },
        { key: "max_words", header: "Maximum words" },
        { key: "scale_min_value", header: "Scale minimum value" },
        { key: "scale_max_value", header: "Scale maximum value" },
        { key: "scale_min_label", header: "Scale minimum label" },
        { key: "scale_max_label", header: "Scale maximum label" },
        { key: "validity_regex", header: "Validity regex" },
        { key: "format_regex", header: "Format regex" },
        { key: "timeline_items_json", header: "Timeline items JSON" },
        { key: "matrix_option_cells_json", header: "Matrix option cells JSON" },
      ],
      results: parsed.items.map((item) => {
        const privateSpecQuiz = handlePrivateSpecMigration(item.private_spec as PrivateSpecQuiz)
        return {
          rows: privateSpecQuiz.items.map((quizItem) => ({
            quiz_title: privateSpecQuiz.title ?? null,
            quiz_item_id: quizItem.id,
            quiz_item_order: quizItem.order,
            quiz_item_type: quizItem.type,
            quiz_item_title: getItemTitle(quizItem),
            quiz_item_body: getItemBody(quizItem),
            option_count: getOptionCount(quizItem),
            option_ids: getOptionIds(quizItem),
            option_titles: getOptionTitles(quizItem),
            correct_option_ids: getCorrectOptionIds(quizItem),
            correct_option_titles: getCorrectOptionTitles(quizItem),
            allow_selecting_multiple_options: getAllowSelectingMultipleOptions(quizItem),
            choose_n: getChooseN(quizItem),
            min_words: getMinWords(quizItem),
            max_words: getMaxWords(quizItem),
            scale_min_value: getScaleMinValue(quizItem),
            scale_max_value: getScaleMaxValue(quizItem),
            scale_min_label: getScaleMinLabel(quizItem),
            scale_max_label: getScaleMaxLabel(quizItem),
            validity_regex: getValidityRegex(quizItem),
            format_regex: getFormatRegex(quizItem),
            timeline_items_json: getTimelineItemsJson(quizItem),
            matrix_option_cells_json: getMatrixOptionCellsJson(quizItem),
          })),
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
