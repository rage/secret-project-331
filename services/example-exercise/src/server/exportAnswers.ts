import { jsonRoute, MAX_EXPORT_REQUEST_BYTES, readJsonBody } from "@/lib/apiRoutes"
import type { CsvExportColumn, CsvExportResponse } from "@/server/csvExportUtils"
import {
  csvText,
  parseItemsRequest,
  parseNumberField,
  parseSpecArrayStrict,
} from "@/server/csvExportUtils"
import {
  migrateAnswerToLatest,
  migratePrivateSpecToLatest,
  parseFeedback,
} from "@/util/migration/migrateToLatest"
import { MalformedBlobError } from "@/util/migration/versions"
import { isAlternative, isObject, type Answer } from "@/util/stateInterfaces"

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

// One student's unreadable answer leaves that row's cells empty rather than failing the export.
function readAnswer(blob: unknown): Answer | null {
  try {
    return migrateAnswerToLatest(blob)
  } catch (error) {
    if (error instanceof MalformedBlobError) {
      return null
    }
    throw error
  }
}

export const handleExportAnswers = jsonRoute(async (request) => {
  const body = await readJsonBody(request, MAX_EXPORT_REQUEST_BYTES)
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
      const selectedOptionId = readAnswer(item.answer)?.selectedOptionId ?? null
      const selectedOption = privateSpec.find((option) => option.id === selectedOptionId) ?? null
      const feedback = parseFeedback(isObject(item.grading) ? item.grading.feedback_json : null)

      return {
        rows: [
          {
            selected_option_id: csvText(selectedOptionId),
            selected_option_name: csvText(selectedOption?.name ?? null),
            selected_option_correct: selectedOption?.correct ?? null,
            grading_selected_option_is_correct: feedback?.selectedOptionIsCorrect ?? null,
            score_given: parseNumberField(item.grading, "score_given"),
          },
        ],
      }
    }),
  }

  return Response.json(response)
})
