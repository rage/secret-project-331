import { isValid, parseISO } from "date-fns"

/**
 * Function, which transforms possible axios response datas ISO-strings (updated_at, created_at, deleted_at) to js Date -objects.
 * @param body AxiosResponse<any>
 * @returns result
 */
export const ISOStringToDateTime = (body: any): void => {
  if (body === null || body === undefined || typeof body !== "object") {
    return body
  }

  for (const key of Object.keys(body)) {
    const value = body[key]
    if (isValid(parseISO(value))) {
      body[key] = parseISO(value)
    } else if (typeof value === "object") {
      ISOStringToDateTime(value)
    }
  }
}
