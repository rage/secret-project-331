import { format, formatDistanceToNow, parse } from "date-fns"
import { toZonedTime } from "date-fns-tz"

export const dateToString = (date: Date | string, timeZone = true): string => {
  try {
    const datePart = `${format(date, "yyyy-MM-dd HH:mm:ss")}`
    const timeZonePart = ` UTC${format(date, `xxx`)}`
    return datePart + (timeZone ? timeZonePart : "")
  } catch (_e) {
    return "Invalid date"
  }
}

export const dateToDateTimeLocalString = (date: Date | string): string => {
  try {
    return `${format(date, "yyyy-MM-dd")}T${format(date, "HH:mm:ss")}`
  } catch (_e) {
    return "Invalid date"
  }
}

/**
 * Formats a given date to a string suitable for use in `<input type="datetime-local">` elements, or the `DateTimeLocal` component from shared module.
 *
 * The `<input type="datetime-local">` element expects the date string to be in the format `YYYY-MM-DDTHH:MM`.
 *
 * @param date - The date to be formatted.
 * @returns A string representing the formatted date in the `YYYY-MM-DDTHH:MM` format.
 */
export const formatDateForDateTimeLocalInputs = (
  date: Date | string | null | undefined,
): string | undefined => {
  if (!date) {
    return undefined
  }
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

export const humanReadableDateTime = (
  date: Date | string | null | undefined,
): string | undefined => {
  const localDate = dateToUsersLocalTimeZone(date)
  if (!localDate) {
    return undefined
  }
  return format(localDate, "Pp")
}

export const getLocalTimeZone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export const dateToUsersLocalTimeZone = (date: Date | string | null | undefined) => {
  if (!date) {
    return undefined
  }

  const timeZone = getLocalTimeZone()
  return toZonedTime(date, timeZone)
}

/**
 * Gets the localized month name for a given month number (1-12)
 * @param month - Month number (1-12)
 * @param locale - Locale string (e.g. 'en', 'fi')
 * @returns Localized month name, falls back to English if locale not supported
 */
export const getLocalizedMonthName = (month: string | number, locale: string): string => {
  const date = new Date(2024, Number(month) - 1, 1)
  try {
    return new Intl.DateTimeFormat(locale, { month: "long" }).format(date)
  } catch {
    // Fallback to English if locale not supported
    return new Intl.DateTimeFormat("en", { month: "long" }).format(date)
  }
}

export const relativeTimeFromTimestamp = (timestamp: string): string => {
  const cleanTimestamp = timestamp.replace(/ UTC[+-]\d{2}:\d{2}/, "")
  const parsedDate = parse(cleanTimestamp, "yyyy-MM-dd HH:mm:ss", new Date())

  return formatDistanceToNow(parsedDate, { addSuffix: true })
}
