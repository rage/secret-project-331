export type ErrorData = { block_id: string }

export interface ErrorResponse {
  title: string
  message: string
  source: string | null
  data: ErrorData | null
}

export const isErrorData = (value: unknown): value is ErrorData => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  return typeof (value as { block_id?: unknown }).block_id === "string"
}

export const isErrorResponse = (value: unknown): value is ErrorResponse => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    (typeof candidate.source === "string" || candidate.source === null) &&
    (candidate.data === null || isErrorData(candidate.data))
  )
}
