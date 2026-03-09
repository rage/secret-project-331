import { NextResponse } from "next/server"

import { PrivateSpecQuiz, PrivateSpecQuizItem } from "../../../../types/quizTypes/privateSpec"
import { handlePrivateSpecMigration } from "../../../grading/utils"

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

function getItemTitle(item: PrivateSpecQuizItem): string | null {
  if ("title" in item) {
    return item.title ?? null
  }
  return null
}

function getItemBody(item: PrivateSpecQuizItem): string | null {
  if ("body" in item) {
    return item.body ?? null
  }
  return null
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
