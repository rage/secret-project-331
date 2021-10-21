import { isValid, parseISO } from "date-fns"

/**
 * Function, which transforms possible axios response datas ISO-strings (updated_at, created_at, deleted_at) to js Date -objects.
 * @param body AxiosResponse<any>
 * @returns result
 */
export const ISOStringToDateTime = (body: unknown): unknown => {
  if (typeof body !== "object" || body === null || body === undefined) {
    return body
  }

  for (const key of Object.keys(body)) {
    // @ts-ignore: key is from Object.keys()
    const value = body[key]
    if (!new RegExp(/\d{4}-\d{2}-\d{2}/).test(value)) {
      continue
    }
    const parsed = parseISO(value)
    if (isValid(parsed)) {
      // @ts-ignore: key is from Object.keys()
      body[key] = parsed
    } else if (typeof value === "object") {
      ISOStringToDateTime(value)
    }
  }
  return body
}
