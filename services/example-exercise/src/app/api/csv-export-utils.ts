import { Alternative } from "@/util/stateInterfaces"

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

export function isAlternative(value: unknown): value is Alternative {
  if (!value || typeof value !== "object") {
    return false
  }
  const typedValue = value as Record<string, unknown>
  return (
    typeof typedValue.id === "string" &&
    typeof typedValue.name === "string" &&
    typeof typedValue.correct === "boolean"
  )
}

export function parsePrivateSpec(value: unknown): Alternative[] {
  if (!Array.isArray(value) || !value.every((item) => isAlternative(item))) {
    throw new Error("Invalid private_spec: expected an array of alternatives")
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

export function parseStringField(value: unknown, fieldName: string): string | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[fieldName] === "string" ? (typedValue[fieldName] as string) : null
}

export function parseBooleanField(value: unknown, fieldName: string): boolean | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[fieldName] === "boolean" ? (typedValue[fieldName] as boolean) : null
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

export function getCorrectOptionIds(privateSpec: Alternative[]): string | null {
  const correctOptionIds = privateSpec.filter((option) => option.correct).map((option) => option.id)
  return correctOptionIds.length > 0 ? correctOptionIds.join("; ") : null
}

export function getCorrectOptionNames(privateSpec: Alternative[]): string | null {
  const correctOptionNames = privateSpec
    .filter((option) => option.correct)
    .map((option) => option.name)
  return correctOptionNames.length > 0 ? correctOptionNames.join("; ") : null
}
