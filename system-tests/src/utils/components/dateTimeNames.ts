/**
 * The names the date/time family renders, and the `Intl` mirrors needed to predict them.
 *
 * The components derive segment names, calendar day labels and the time panel's display string from
 * `Intl` in the locale react-aria's `I18nProvider` supplies, so a driver that wants to address them
 * has to run the same `Intl` calls rather than hardcode strings. The i18next-backed labels in
 * {@link DATE_PICKER_LABELS} are the exception: those are translations, listed here in English
 * because `system-tests` pins `LANGUAGE=en_US`.
 */

/** Locale the app passes to react-aria's `I18nProvider`; every name below is resolved in it. */
export const DEFAULT_TEMPORAL_LOCALE = "en"

/** Editable parts a segmented date/time control can expose. */
export type TemporalSegment = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod"

/** English `datePicker.*` translations used as accessible names in the calendar and choosers. */
export const DATE_PICKER_LABELS = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  previousYear: "Previous year",
  nextYear: "Next year",
  previousYears: "Previous years",
  nextYears: "Next years",
  clear: "Clear",
  today: "Today",
  now: "Now",
  tomorrow: "Tomorrow",
  nextWeek: "Next week",
  time: "Time",
  plus30Minutes: "+30 min",
  endOfDay: "End of day",
  chooseMonth: "Choose month",
  chooseYear: "Choose year",
  decreaseHour: "Decrease hour",
  increaseHour: "Increase hour",
  decreaseMinute: "Decrease minute",
  increaseMinute: "Increase minute",
  dayPeriod: "Day period",
} as const

/** Accessible name of the calendar header buttons that open the month/year chooser. */
export function chooseMonthAndYearLabel(visibleLabel: string): string {
  return `Choose month and year: ${visibleLabel}`
}

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Turns a literal into a pattern that tolerates any whitespace where the literal had some.
 *
 * `Intl` puts a narrow no-break space before AM/PM in newer ICU versions, and the browser's ICU
 * need not match Node's, so comparing formatted strings byte for byte across the two is unreliable.
 */
function whitespaceTolerantPattern(literal: string): string {
  return escapeForRegExp(literal).replaceAll(/\s/gu, "\\s")
}

/**
 * Matches one segment of a segmented field by the accessible name react-aria gives it.
 *
 * The name is `"<segment display name>, <field label>"`, so the pattern is anchored to the front:
 * the label is caller-supplied and may well contain the segment's own word ("Academic year").
 */
export function segmentNamePattern(
  segment: TemporalSegment,
  locale = DEFAULT_TEMPORAL_LOCALE,
): RegExp {
  const displayName = new Intl.DisplayNames(locale, { type: "dateTimeField" }).of(segment)
  if (displayName === undefined) {
    throw new Error(`The ${locale} locale has no display name for the "${segment}" segment.`)
  }
  return new RegExp(`^${escapeForRegExp(displayName)}`, "i")
}

/**
 * Matches a calendar day button, whose accessible name is the fully formatted date.
 *
 * Unanchored on purpose: react-aria wraps the date in "Today, …", "Selected, …" and appends
 * ", First available date" at the range edges.
 *
 * @param isoDate a `yyyy-MM-dd` date
 */
export function calendarDayNamePattern(isoDate: string, locale = DEFAULT_TEMPORAL_LOCALE): RegExp {
  const { year, month, day } = parseIsoDate(isoDate)
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
  return new RegExp(whitespaceTolerantPattern(formatted))
}

/** True when the locale (or an explicit override) renders times with an AM/PM part. */
export function showsDayPeriod(locale = DEFAULT_TEMPORAL_LOCALE, hourCycle?: 12 | 24): boolean {
  const options: Intl.DateTimeFormatOptions =
    hourCycle === undefined ? { hour: "numeric" } : { hour: "numeric", hour12: hourCycle === 12 }
  const resolved = new Intl.DateTimeFormat(locale, options).resolvedOptions().hourCycle
  return resolved === "h11" || resolved === "h12"
}

/** The locale's AM and PM strings, as the day-period buttons and the time panel render them. */
export function dayPeriodLabels(locale = DEFAULT_TEMPORAL_LOCALE): { am: string; pm: string } {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    hour12: true,
    timeZone: "UTC",
  })
  const labelAt = (hour: number, fallback: string) =>
    formatter
      .formatToParts(new Date(Date.UTC(2024, 0, 1, hour)))
      .find((p) => p.type === "dayPeriod")?.value ?? fallback
  return { am: labelAt(9, "AM"), pm: labelAt(21, "PM") }
}

/** Matches the whole of the time panel's read-back string for the given wall-clock time. */
export function displayedTimePattern(
  hour: number,
  minute: number,
  second: number,
  locale = DEFAULT_TEMPORAL_LOCALE,
  hourCycle?: 12 | 24,
): RegExp {
  const formatted = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: showsDayPeriod(locale, hourCycle),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute, second)))
  return new RegExp(`^${whitespaceTolerantPattern(formatted)}$`)
}

/** Matches a time panel read-back that is in the given half of the day. */
export function dayPeriodPattern(period: "am" | "pm", locale = DEFAULT_TEMPORAL_LOCALE): RegExp {
  return new RegExp(whitespaceTolerantPattern(dayPeriodLabels(locale)[period]))
}

/** Segment text to type, in the order the segments should be filled. */
export type SegmentEntry = readonly [TemporalSegment, string]

function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) {
    throw new Error(`Expected a yyyy-MM-dd date, got "${isoDate}".`)
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function parseIsoTime(isoTime: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(isoTime)
  if (!match) {
    throw new Error(`Expected an HH:mm time, got "${isoTime}".`)
  }
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

/** Date segments to type for a `yyyy-MM-dd` value. */
export function dateSegmentEntries(isoDate: string): SegmentEntry[] {
  const { year, month, day } = parseIsoDate(isoDate)
  return [
    ["year", String(year).padStart(4, "0")],
    ["month", String(month).padStart(2, "0")],
    ["day", String(day).padStart(2, "0")],
  ]
}

/**
 * Time segments to type for an `HH:mm` value.
 *
 * A 12-hour field shows the hour as 1-12 and carries a separate day-period segment, which
 * react-aria sets from the first character of the locale's AM/PM string.
 */
export function timeSegmentEntries(
  isoTime: string,
  hasDayPeriodSegment: boolean,
  locale = DEFAULT_TEMPORAL_LOCALE,
): SegmentEntry[] {
  const { hour, minute } = parseIsoTime(isoTime)
  const minuteEntry: SegmentEntry = ["minute", String(minute).padStart(2, "0")]

  if (!hasDayPeriodSegment) {
    return [["hour", String(hour).padStart(2, "0")], minuteEntry]
  }

  const labels = dayPeriodLabels(locale)
  const period = hour >= 12 ? labels.pm : labels.am
  return [
    ["hour", String(hour % 12 === 0 ? 12 : hour % 12)],
    minuteEntry,
    ["dayPeriod", period.slice(0, 1)],
  ]
}

/** Segments to type for a `yyyy-MM-ddTHH:mm` value. */
export function dateTimeSegmentEntries(
  isoDateTime: string,
  hasDayPeriodSegment: boolean,
  locale = DEFAULT_TEMPORAL_LOCALE,
): SegmentEntry[] {
  const [isoDate, isoTime] = isoDateTime.split("T")
  if (isoDate === undefined || isoTime === undefined) {
    throw new Error(`Expected a yyyy-MM-ddTHH:mm datetime, got "${isoDateTime}".`)
  }
  return [
    ...dateSegmentEntries(isoDate),
    ...timeSegmentEntries(isoTime, hasDayPeriodSegment, locale),
  ]
}
