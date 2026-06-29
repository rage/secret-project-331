import { NextResponse } from "next/server"

import {
  CsvExportColumn,
  CsvExportResponse,
  parseItemsRequest,
  parsePrivateSpecStrict,
} from "../csv-export-utils"

import { jsonRoute, readJsonBody } from "@/lib/apiRoutes"

interface CsvExportDefinitionsRequestItem {
  private_spec: unknown
}

const COLUMNS: CsvExportColumn[] = [
  { key: "option_index", header: "Option index" },
  { key: "option_count", header: "Option count" },
  { key: "option_id", header: "Option id" },
  { key: "option_name", header: "Option name" },
  { key: "option_correct", header: "Option is correct" },
]

export const POST = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  const parsed = parseItemsRequest<CsvExportDefinitionsRequestItem>(body)

  const response: CsvExportResponse = {
    columns: COLUMNS,
    results: parsed.items.map((item) => {
      const privateSpec = parsePrivateSpecStrict(item.private_spec)
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
