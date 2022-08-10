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
    if (typeof value !== "object" && !new RegExp(/^^\d{4}-\d{2}-\d{2}[T].*[Z]$/).test(value)) {
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

/**
 * Function, which returns the difference of two Date objects in days
 * @param first first date object
 * @param second second date object, if let out will default to current date
 */
export const dateDiffInDays = (first: Date, second: Date = new Date()): number => {
  const _MS_PER_DAY = 1000 * 60 * 60 * 24

  const utc1 = Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())
  const utc2 = Date.UTC(second.getFullYear(), second.getMonth(), second.getDate())

  return Math.floor((utc2 - utc1) / _MS_PER_DAY)
}
