import { NextResponse } from "next/server"

import { CsvExportResponse, parsePrivateSpec } from "../csv-export-utils"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"

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

async function postImpl(request: Request) {
  try {
    const body = await request.json()
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

const SERVICE = "example-exercise"

export const POST = wrapRouteHandler(postImpl, {
  service: SERVICE,
  operation: "POST /export-definitions",
})
export const GET = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "GET /export-definitions",
})
export const PUT = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "PUT /export-definitions",
})
export const PATCH = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "PATCH /export-definitions",
})
export const DELETE = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "DELETE /export-definitions",
})
export const OPTIONS = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "OPTIONS /export-definitions",
})
export const HEAD = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "HEAD /export-definitions",
})
