// The i18next literal-string lint only runs on .tsx, so `RelativeTime`'s formatting lives here:
// every literal below is an `Intl` option value, not user-facing copy.

/**
 * Each entry divides `duration` down to the next unit; `limit` is that divisor, not an
 * absolute threshold (so "weeks" divides by ~4.35 to reach "months", not by a week count).
 * Years is the fallback below, so it needs no row.
 */
const RELATIVE_TIME_UNITS: { limit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, unit: "seconds" },
  { limit: 60, unit: "minutes" },
  { limit: 24, unit: "hours" },
  { limit: 7, unit: "days" },
  { limit: 4.34524, unit: "weeks" },
  { limit: 12, unit: "months" },
]

const YEARS: Intl.RelativeTimeFormatUnit = "years"

const RELATIVE_TIME_OPTIONS: Intl.RelativeTimeFormatOptions = { numeric: "auto" }

// Resolving a locale costs more than the format call; tables render one instance per row.
const formatterCache = new Map<string, Intl.RelativeTimeFormat>()

function relativeTimeFormatter(locale: string): Intl.RelativeTimeFormat {
  const cached = formatterCache.get(locale)
  if (cached) {
    return cached
  }
  const formatter = new Intl.RelativeTimeFormat(locale, RELATIVE_TIME_OPTIONS)
  formatterCache.set(locale, formatter)
  return formatter
}

/** The distance between `at` and now as a locale-aware phrase, e.g. "3 hours ago". */
export function formatRelativeDistance(at: Date, locale: string): string {
  const formatter = relativeTimeFormatter(locale)
  let duration = (at.getTime() - Date.now()) / 1000
  for (const { limit, unit } of RELATIVE_TIME_UNITS) {
    if (Math.abs(duration) < limit) {
      return formatter.format(Math.round(duration), unit)
    }
    duration /= limit
  }
  return formatter.format(Math.round(duration), YEARS)
}

/**
 * Timestamps in the project's format rather than the locale's: `Intl`'s date styles render a
 * Finnish September as "7. syysk. klo 12.10", which is not a format this project shows anywhere.
 *
 * These reproduce `dateToString` and `formatDateForDateInputs` from the common package's
 * `utils/time`. This package depends on neither common nor date-fns, so the two sides only stay in
 * step by being changed together.
 */
const pad = (value: number): string => String(value).padStart(2, "0")

/** `2026-09-07`, as `formatDateForDateInputs` returns. */
export function formatIsoDate(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/** `2026-09-07 12:10:45`, as `dateToString(at, false)` returns. */
export function formatTimestamp(at: Date): string {
  return `${formatIsoDate(at)} ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
}

/** The same, plus the offset `dateToString` appends: `2026-09-07 12:10:45 UTC+03:00`. */
export function formatTimestampWithZone(at: Date): string {
  const offsetMinutes = -at.getTimezoneOffset()
  const sign = offsetMinutes < 0 ? "-" : "+"
  const absolute = Math.abs(offsetMinutes)
  return `${formatTimestamp(at)} UTC${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}

const DURATION_UNITS = {
  DAY: "day",
  HOUR: "hour",
  MINUTE: "minute",
  SECOND: "second",
} as const satisfies Record<string, Intl.NumberFormatOptions["unit"]>

type DurationUnit = (typeof DURATION_UNITS)[keyof typeof DURATION_UNITS]

const NARROW_UNIT_OPTIONS = { style: "unit", unitDisplay: "narrow" } as const

// `Intl.NumberFormat`'s narrow unit style joins number and abbreviation with no space (e.g.
// "26d"); formatToParts lets us keep the locale's own abbreviation while inserting one.
function formatUnitNarrow(value: number, unit: DurationUnit, locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    ...NARROW_UNIT_OPTIONS,
    unit,
  }).formatToParts(value)
  const numeral = parts
    .filter((part) => part.type !== "unit")
    .map((part) => part.value)
    .join("")
  const unitText = parts.find((part) => part.type === "unit")?.value ?? ""
  return `${numeral} ${unitText}`
}

/**
 * The elapsed span between `at` and now, as its one or two largest units (e.g. "26 d",
 * "3 h 12 min"). Always positive: a duration, not a point in time, so it reads the same whether
 * `at` is in the past or the future.
 */
export function formatDuration(at: Date, locale: string): string {
  const totalSeconds = Math.round(Math.abs(Date.now() - at.getTime()) / 1000)

  const days = Math.floor(totalSeconds / 86400)
  if (days >= 1) {
    return formatUnitNarrow(days, DURATION_UNITS.DAY, locale)
  }

  const hours = Math.floor(totalSeconds / 3600)
  if (hours >= 1) {
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return minutes > 0
      ? `${formatUnitNarrow(hours, DURATION_UNITS.HOUR, locale)} ${formatUnitNarrow(minutes, DURATION_UNITS.MINUTE, locale)}`
      : formatUnitNarrow(hours, DURATION_UNITS.HOUR, locale)
  }

  const minutes = Math.floor(totalSeconds / 60)
  if (minutes >= 1) {
    return formatUnitNarrow(minutes, DURATION_UNITS.MINUTE, locale)
  }

  return formatUnitNarrow(totalSeconds, DURATION_UNITS.SECOND, locale)
}
