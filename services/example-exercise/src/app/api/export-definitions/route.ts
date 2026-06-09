import { NextResponse } from "next/server"

import { CsvExportResponse, parsePrivateSpec } from "../csv-export-utils"

import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"

interface CsvExportDefinitionsRequestItem {
  private_spec: unknown
}

interface CsvExportDefinitionsRequest {
  items: CsvExportDefinitionsRequestItem[]
}

function parseRequest(body: unknown): CsvExportDefinitionsRequest {
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as Record<string, unknown>).items)
  ) {
    throw new BadRequestError("Invalid request body: items must be an array")
  }
  return body as CsvExportDefinitionsRequest
}

export const POST = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  const parsed = parseRequest(body)

  const response: CsvExportResponse = {
    columns: [
      { key: "option_index", header: "Option index" },
      { key: "option_count", header: "Option count" },
      { key: "option_id", header: "Option id" },
      { key: "option_name", header: "Option name" },
      { key: "option_correct", header: "Option is correct" },
    ],
    results: parsed.items.map((item) => {
      const privateSpec = parsePrivateSpec(item.private_spec)
      return {
        rows: privateSpec.map((alternative, index) => ({
          option_index: index,
          option_count: privateSpec.length,
          option_id: alternative.id,
          option_name: alternative.name,
          option_correct: alternative.correct,
        })),
      }
    }),
  }

  return NextResponse.json(response)
})
