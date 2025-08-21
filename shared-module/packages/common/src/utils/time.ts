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

/**
 * Converts a date to a human-readable string in the user's local timezone.
 *
 * This function takes a date input (Date object, string, null, or undefined) and
 * converts it to a localized string representation that includes the month name,
 * day, time, and timezone offset. The date is automatically converted to the
 * user's local timezone before formatting.
 *
 * @param date - The date to format. Can be a Date object, date string, null, or undefined.
 *               If null or undefined, the function returns undefined.
 * @param locale - The locale string to use for formatting (e.g., 'en-US', 'sv-SE').
 *                 This determines the language and formatting conventions used.
 *
 * @returns A human-readable date-time string in the format "Month Day, Hour:Minute:Second (TimezoneOffset)"
 *          (e.g., "December 25, 14:30:45 (UTC+3)"), or undefined if the input date is null/undefined.
 *
 * @example
 * ```typescript
 * humanReadableDateTime(new Date('2023-12-25T13:30:45Z'), 'en-US')
 * // Returns: "December 25, 2:30:45 PM (UTC+3)" (depending on local timezone)
 *
 * humanReadableDateTime('2023-12-25T13:30:45Z', 'sv-SE')
 * // Returns: "25 december 14:30:45 (UTC+3)" (depending on local timezone)
 *
 * humanReadableDateTime(null, 'en-US')
 * // Returns: undefined
 * ```
 */
export const humanReadableDateTime = (
  date: Date | string | null | undefined,
  locale: string,
): string | undefined => {
  const localDate = dateToUsersLocalTimeZone(date)
  if (!localDate) {
    return undefined
  }

  const base = localDate.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })

  return `${base} (${timeZoneOffsetString(localDate)})`
}

/**
 * Helper get time zone offset string in the format "UTC+3", "UTC-5:30", etc.
 * Minutes are only included if they are non-zero.
 * @param date - The date to compute the time zone offset for.
 * @returns A string representing the time zone offset in the format "UTC+3", "UTC-5:30", etc.
 */
export const timeZoneOffsetString = (date: Date): string => {
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? "+" : "-"
  const abs = Math.abs(offsetMin)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60

  if (minutes === 0) {
    return `UTC${sign}${hours}`
  }

  const minutesStr = String(minutes).padStart(2, "0")
  return `UTC${sign}${hours}:${minutesStr}`
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
