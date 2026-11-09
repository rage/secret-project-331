import { differenceInCalendarDays, format, parseISO, startOfToday } from "date-fns"

// Plan dates are `yyyy-mm-dd` calendar days; parseISO reads them as local days, whereas
// `new Date(isoDate)` reads a UTC instant that shows as the previous day west of UTC.

const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
}

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
}

const MONTH_YEAR_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "long",
  year: "numeric",
}

const MONTH_DAY_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
}

/** Formats a plan date as a long local date. */
export function formatPlanDate(isoDate: string, locale: string): string {
  return parseISO(isoDate).toLocaleDateString(locale, LONG_DATE_OPTIONS)
}

/** Formats a plan date as a short local date; a string that is not a date is returned as it is. */
export function formatPlanShortDate(isoDate: string, locale: string): string {
  const date = parseISO(isoDate)
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString(locale, SHORT_DATE_OPTIONS)
}

/** Formats a plan date as its month and year, e.g. "March 2027". */
export function formatPlanMonthYear(isoDate: string, locale: string): string {
  return parseISO(isoDate).toLocaleDateString(locale, MONTH_YEAR_OPTIONS)
}

/** Formats two plan dates as a day-and-month range; `undefined` uses the browser's locale. */
export function formatPlanDateRange(
  startsOn: string,
  endsOn: string,
  locale: string | undefined,
): string {
  const startsOnText = parseISO(startsOn).toLocaleDateString(locale, MONTH_DAY_OPTIONS)
  const endsOnText = parseISO(endsOn).toLocaleDateString(locale, MONTH_DAY_OPTIONS)
  // oxlint-disable-next-line i18next/no-literal-string -- a range separator, not copy
  return `${startsOnText} – ${endsOnText}`
}

/** A local calendar day as a plan date. */
export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

/** Calendar days from today until a plan date; negative once the date has passed. */
export function daysUntilPlanDate(isoDate: string): number {
  return differenceInCalendarDays(parseISO(isoDate), startOfToday())
}
