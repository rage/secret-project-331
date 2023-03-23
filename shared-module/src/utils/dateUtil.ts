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

/**
 * Make timezone errors less likely in date strings. If time is not specified, sets the time to the middle of day so that the date is less likely to change if some system assumes the time is in a wrong timezone.
 *
 * The case that this is preventing may something like this:
 * 1. The user inputs only the date (without time), e.g. "2023-01-01"
 * 2. Parsing the date defaults the time to 0, e.g. "2023-01-01T00:00:00"
 * 3. Some system that may or may not control by us assumes the timestamp is in a timezone that was not intended and substracts some hours from the timestamp. Suddenly the completion date is not 2023-01-01 anymore.
 *
 * The fix is to default the time to the middle of the day.
 *
 * @param dateString Date in a string format.
 * @returns Modified date string
 */
export const makeDateStringTimezoneErrorsLessLikely = (dateString: string): string => {
  const input = dateString.trim()
  if (!/^\d+-\d+-\d+$/.test(input)) {
    // The date string specifies something other than a date. We won't do anything in this case.
    return input
  }
  // eslint-disable-next-line i18next/no-literal-string
  return `${input}T12:00:00`
}
