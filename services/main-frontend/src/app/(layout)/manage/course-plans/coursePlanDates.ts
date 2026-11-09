import { differenceInCalendarDays, parseISO, startOfToday } from "date-fns"

const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
}

/** Formats a plan date (`yyyy-mm-dd`) as a long local date, read as a calendar day, not a UTC instant. */
export function formatPlanDate(isoDate: string, locale: string): string {
  return parseISO(isoDate).toLocaleDateString(locale, LONG_DATE_OPTIONS)
}

/** Calendar days from today until a plan date (`yyyy-mm-dd`); negative once the date has passed. */
export function daysUntilPlanDate(isoDate: string): number {
  return differenceInCalendarDays(parseISO(isoDate), startOfToday())
}
