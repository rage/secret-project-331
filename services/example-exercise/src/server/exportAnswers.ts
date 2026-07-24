import { jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import type { CsvExportColumn, CsvExportResponse } from "@/server/csvExportUtils"
import {
  parseBooleanFieldFromObject,
  parseItemsRequest,
  parseNumberField,
  parseSpecArrayStrict,
  parseStringField,
} from "@/server/csvExportUtils"
import { migratePrivateSpecToLatest } from "@/util/migration/migrateToLatest"
import { isAlternative } from "@/util/stateInterfaces"

interface CsvExportAnswersRequestItem {
  private_spec: unknown
  answer: unknown
  grading: unknown
  model_solution_spec: unknown
}

const COLUMNS: CsvExportColumn[] = [
  { key: "selected_option_id", header: "Selected option id" },
  { key: "selected_option_name", header: "Selected option name" },
  { key: "selected_option_correct", header: "Selected option is correct" },
  {
    key: "grading_selected_option_is_correct",
    header: "Grading says selected option is correct",
  },
  { key: "score_given", header: "Score given" },
]

export const handleExportAnswers = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  const parsed = parseItemsRequest<CsvExportAnswersRequestItem>(body)

  const response: CsvExportResponse = {
    columns: COLUMNS,
    results: parsed.items.map((item) => {
      const privateSpec = parseSpecArrayStrict(
        // migrate to latest, then validate strictly.
        migratePrivateSpecToLatest(item.private_spec),
        isAlternative,
        "Invalid private_spec: expected an array of alternatives",
      )
      const selectedOptionId = parseStringField(item.answer, "selectedOptionId")
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

  return Response.json(response)
})
