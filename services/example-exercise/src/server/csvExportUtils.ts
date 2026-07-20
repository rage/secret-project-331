import { BadRequestError } from "@/lib/apiRoutes"
import type { Alternative } from "@/util/stateInterfaces"
import { isAlternative } from "@/util/stateInterfaces"

export type CsvScalar = string | number | boolean | null

export interface CsvExportColumn {
  key: string
  header: string
}

export interface CsvExportResult {
  rows: Record<string, CsvScalar>[]
}

export interface CsvExportResponse {
  columns: CsvExportColumn[]
  results: CsvExportResult[]
}

export interface CsvExportRequest<T> {
  items: T[]
}

/** Validates that the body is `{ items: [...] }`, throwing a 400 otherwise. */
export function parseItemsRequest<T>(body: unknown): CsvExportRequest<T> {
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as Record<string, unknown>).items)
  ) {
    throw new BadRequestError("Invalid request body: items must be an array")
  }
  return body as CsvExportRequest<T>
}

/**
 * Validates that the value is the exercise's private spec, throwing a 400 otherwise. This is the
 * strict counterpart to the forgiving `parsePrivateSpec` in `stateInterfaces.ts`: the export
 * endpoints reject malformed specs, while the iframe view tolerates them.
 */
export function parsePrivateSpecStrict(value: unknown): Alternative[] {
  if (!Array.isArray(value) || !value.every((alternative) => isAlternative(alternative))) {
    throw new BadRequestError("Invalid private_spec: expected an array of alternatives")
  }
  return value
}

export function parseSelectedOptionId(answer: unknown): string | null {
  if (!answer || typeof answer !== "object") {
    return null
  }
  const typedAnswer = answer as Record<string, unknown>
  return typeof typedAnswer.selectedOptionId === "string" ? typedAnswer.selectedOptionId : null
}

export function parseNumberField(value: unknown, fieldName: string): number | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[fieldName] === "number" ? (typedValue[fieldName] as number) : null
}

export function parseBooleanFieldFromObject(
  value: unknown,
  objectFieldName: string,
  fieldName: string,
): boolean | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  const nestedValue = typedValue[objectFieldName]
  if (!nestedValue || typeof nestedValue !== "object") {
    return null
  }
  const typedNestedValue = nestedValue as Record<string, unknown>
  return typeof typedNestedValue[fieldName] === "boolean"
    ? (typedNestedValue[fieldName] as boolean)
    : null
}
