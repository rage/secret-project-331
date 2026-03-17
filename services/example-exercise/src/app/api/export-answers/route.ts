import { NextResponse } from "next/server"

import {
  CsvExportResponse,
  parseBooleanFieldFromObject,
  parseNumberField,
  parsePrivateSpec,
  parseSelectedOptionId,
} from "../csv-export-utils"

interface CsvExportAnswersRequestItem {
  private_spec: unknown
  answer: unknown
  grading: unknown
  model_solution_spec: unknown
}

interface CsvExportAnswersRequest {
  items: CsvExportAnswersRequestItem[]
}

function parseRequest(body: unknown): CsvExportAnswersRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }
  if (!Array.isArray((body as Record<string, unknown>).items)) {
    throw new Error("Invalid request body: items must be an array")
  }
  return body as CsvExportAnswersRequest
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = parseRequest(body)

    const response: CsvExportResponse = {
      columns: [
        { key: "selected_option_id", header: "Selected option id" },
        { key: "selected_option_name", header: "Selected option name" },
        { key: "selected_option_correct", header: "Selected option is correct" },
        {
          key: "grading_selected_option_is_correct",
          header: "Grading says selected option is correct",
        },
        { key: "score_given", header: "Score given" },
      ],
      results: parsed.items.map((item) => {
        const privateSpec = parsePrivateSpec(item.private_spec)
        const selectedOptionId = parseSelectedOptionId(item.answer)
        const selectedOption = privateSpec.find((option) => option.id === selectedOptionId) ?? null

        return {
          rows: [
            {
              selected_option_id: selectedOptionId,
              selected_option_name: selectedOption?.name ?? null,
              selected_option_correct: selectedOption?.correct ?? null,
              grading_selected_option_is_correct: parseBooleanFieldFromObject(
                item.grading,
                "feedback_json",
                "selectedOptionIsCorrect",
              ),
              score_given: parseNumberField(item.grading, "score_given"),
            },
          ],
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
