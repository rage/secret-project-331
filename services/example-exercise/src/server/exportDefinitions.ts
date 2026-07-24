import { jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import {
  parseItemsRequest,
  parseSpecArrayStrict,
  type CsvExportColumn,
  type CsvExportResponse,
} from "@/server/csvExportUtils"
import { migratePrivateSpecToLatest } from "@/util/migration/migrateToLatest"
import { isAlternative } from "@/util/stateInterfaces"

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

export const handleExportDefinitions = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  const parsed = parseItemsRequest<CsvExportDefinitionsRequestItem>(body)

  const response: CsvExportResponse = {
    columns: COLUMNS,
    results: parsed.items.map((item) => {
      const privateSpec = parseSpecArrayStrict(
        // migrate to latest, then validate strictly.
        migratePrivateSpecToLatest(item.private_spec),
        isAlternative,
        "Invalid private_spec: expected an array of alternatives",
      )
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

  return Response.json(response)
})
