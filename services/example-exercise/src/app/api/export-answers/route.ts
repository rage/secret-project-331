import { NextResponse } from "next/server"

import {
  CsvExportResponse,
  parseBooleanFieldFromObject,
  parseNumberField,
  parsePrivateSpec,
  parseSelectedOptionId,
} from "../csv-export-utils"

import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"

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
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as Record<string, unknown>).items)
  ) {
    throw new BadRequestError("Invalid request body: items must be an array")
  }
  return body as CsvExportAnswersRequest
}

export const POST = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
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
})
