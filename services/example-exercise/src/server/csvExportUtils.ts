import { BadRequestError } from "@/lib/apiRoutes"

export type CsvScalar = string | number | boolean | null

export interface CsvExportColumn {
  key: string
  header: string
}

export interface CsvExportResult {
  rows: Array<Record<string, CsvScalar>>
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
 * Validates that `value` is an array whose every item passes `isItem`, throwing a 400 otherwise.
 * This is the strict counterpart to the forgiving array parsers in `stateInterfaces.ts`: the export
 * endpoints reject malformed specs, while the iframe views tolerate them. Generic on purpose — pass
 * your exercise's own item guard (e.g. `isAlternative`) so this file stays free of exercise types.
 */
export function parseSpecArrayStrict<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
  message = "Invalid private_spec: expected an array of the exercise's spec items",
): T[] {
  if (!Array.isArray(value) || !value.every(isItem)) {
    throw new BadRequestError(message)
  }
  return value
}

/** Reads a top-level string field off an object, or `null` if absent/not a string. */
export function parseStringField(value: unknown, fieldName: string): string | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[fieldName] === "string" ? (typedValue[fieldName] as string) : null
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
