import { NextResponse } from "next/server"

import { Alternative } from "@/util/stateInterfaces"

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

interface CsvExportAnswersRequestItem {
  private_spec: unknown
  answer: unknown
  grading: unknown
  model_solution_spec: unknown
}

interface CsvExportAnswersRequest {
  items: CsvExportAnswersRequestItem[]
}

function isAlternative(value: unknown): value is Alternative {
  if (!value || typeof value !== "object") {
    return false
  }
  const typedValue = value as Record<string, unknown>
  return (
    typeof typedValue.id === "string" &&
    typeof typedValue.name === "string" &&
    typeof typedValue.correct === "boolean"
  )
}

function parsePrivateSpec(value: unknown): Alternative[] {
  if (!Array.isArray(value) || !value.every((item) => isAlternative(item))) {
    throw new Error("Invalid private_spec: expected an array of alternatives")
  }
  return value
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

function parseSelectedOptionId(answer: unknown): string | null {
  if (!answer || typeof answer !== "object") {
    return null
  }
  const typedAnswer = answer as Record<string, unknown>
  return typeof typedAnswer.selectedOptionId === "string" ? typedAnswer.selectedOptionId : null
}

function parseNumberField(value: unknown, fieldName: string): number | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[fieldName] === "number" ? (typedValue[fieldName] as number) : null
}

function parseStringField(value: unknown, fieldName: string): string | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[fieldName] === "string" ? (typedValue[fieldName] as string) : null
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
        { key: "score_given", header: "Score given" },
        { key: "grading_progress", header: "Grading progress" },
        { key: "feedback_text", header: "Feedback text" },
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
              score_given: parseNumberField(item.grading, "score_given"),
              grading_progress: parseStringField(item.grading, "grading_progress"),
              feedback_text: parseStringField(item.grading, "feedback_text"),
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
