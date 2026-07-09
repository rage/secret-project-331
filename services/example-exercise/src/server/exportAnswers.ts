import { jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import {
  CsvExportColumn,
  CsvExportResponse,
  parseBooleanFieldFromObject,
  parseItemsRequest,
  parseNumberField,
  parsePrivateSpecStrict,
  parseSelectedOptionId,
} from "@/server/csvExportUtils"

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
      const privateSpec = parsePrivateSpecStrict(item.private_spec)
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

  return Response.json(response)
})
