import { DateTime } from "luxon"

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
    if (DateTime.fromISO(value).isValid) {
      body[key] = DateTime.fromISO(value)
    } else if (typeof value === "object") {
      ISOStringToDateTime(value)
    }
  }
  return body
}

/**
 *Function, which transforms possible axios request datas DateTime -objects (updated_at, created_at, deleted_at) to ISO-strings.
 * @param body frontend data
 */
export const DateTimeToISOString = (body: any): void => {
  if (body === null || body === undefined || typeof body !== "object") {
    return body
  }

  for (const key of Object.keys(body)) {
    const value = body[key]
    if (value instanceof DateTime) {
      body[key] = value.toISO()
    } else if (typeof value === "object") {
      DateTimeToISOString(value)
    }
  }
  return body
}
