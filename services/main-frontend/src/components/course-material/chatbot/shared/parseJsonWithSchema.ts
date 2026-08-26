import type { z } from "zod"

/** Parses `json` and validates it against `schema`, or returns null if either step fails. */
export const parseJsonWithSchema = <T>(json: string, schema: z.ZodType<T>): T | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const result = schema.safeParse(parsed)
  return result.success ? result.data : null
}
