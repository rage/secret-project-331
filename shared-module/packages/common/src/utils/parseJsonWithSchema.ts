import { z } from "zod"

const jsonCodec = <T extends z.ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString)
      } catch (err) {
        ctx.issues.push({
          code: "invalid_format",
          format: "json",
          input: jsonString,
          message: err instanceof Error ? err.message : "Invalid JSON",
        })
        return z.NEVER
      }
    },
    encode: (value) => JSON.stringify(value),
  })

/** Parses `json` and validates it against `schema`, or returns null if either step fails. */
export const parseJsonWithSchema = <T>(json: string, schema: z.ZodType<T>): T | null => {
  const result = z.safeDecode(jsonCodec(schema), json)
  return result.success ? result.data : null
}
