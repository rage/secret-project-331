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

interface CsvExportDefinitionsRequestItem {
  private_spec: unknown
}

interface CsvExportDefinitionsRequest {
  items: CsvExportDefinitionsRequestItem[]
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

function parseRequest(body: unknown): CsvExportDefinitionsRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }
  if (!Array.isArray((body as Record<string, unknown>).items)) {
    throw new Error("Invalid request body: items must be an array")
  }
  return body as CsvExportDefinitionsRequest
}

function parsePrivateSpec(value: unknown): Alternative[] {
  if (!Array.isArray(value) || !value.every((item) => isAlternative(item))) {
    throw new Error("Invalid private_spec: expected an array of alternatives")
  }
  return value
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = parseRequest(body)

    const response: CsvExportResponse = {
      columns: [
        { key: "option_id", header: "Option id" },
        { key: "option_name", header: "Option name" },
        { key: "option_correct", header: "Option is correct" },
      ],
      results: parsed.items.map((item) => {
        const privateSpec = parsePrivateSpec(item.private_spec)
        return {
          rows: privateSpec.map((alternative) => ({
            option_id: alternative.id,
            option_name: alternative.name,
            option_correct: alternative.correct,
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
