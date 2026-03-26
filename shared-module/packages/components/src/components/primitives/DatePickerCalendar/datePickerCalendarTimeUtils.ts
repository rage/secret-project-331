import { parseTime, Time } from "@internationalized/date"
import type { TimeValue } from "react-aria"

import {
  dayPeriodAm,
  dayPeriodPm,
  hourCycleH12,
  hourCycleH23,
  numericDateTimePart,
} from "./datePickerCalendarConstants"
import type { DayPeriod, SupportedHourCycle } from "./datePickerCalendarTypes"

/** Resolves the browser hour cycle for the current locale. */
export function resolveHourCycle(locale: string, hourCycle?: 12 | 24): SupportedHourCycle {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: numericDateTimePart,
    ...(hourCycle ? { hour12: hourCycle === 12 } : undefined),
  })
  const resolvedOptions = formatter.resolvedOptions() as Intl.ResolvedDateTimeFormatOptions & {
    hourCycle?: string
  }
  const resolvedHourCycle = resolvedOptions.hourCycle

  if (
    resolvedHourCycle === "h11" ||
    resolvedHourCycle === "h12" ||
    resolvedHourCycle === "h23" ||
    resolvedHourCycle === "h24"
  ) {
    return resolvedHourCycle
  }

  return hourCycle === 12 ? hourCycleH12 : hourCycleH23
}

/** Returns localized AM/PM labels for 12-hour time UI. */
export function resolveDayPeriodLabels(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: numericDateTimePart,
    hour12: true,
    timeZone: "UTC",
  })

  const resolveLabel = (hour: number, fallback: string) => {
    const parts = formatter.formatToParts(new Date(Date.UTC(2024, 0, 1, hour)))
    return parts.find((part) => part.type === "dayPeriod")?.value ?? fallback
  }

  return {
    am: resolveLabel(9, "AM"),
    pm: resolveLabel(21, "PM"),
  }
}

/** Returns which half of the day the given time falls in. */
export function getSelectedDayPeriod(value: TimeValue | null) {
  if (!value) {
    return null
  }

  return value.hour >= 12 ? dayPeriodPm : dayPeriodAm
}

/** Maps a wall-clock hour to the display hour for the given cycle. */
export function getDisplayHour(hour: number, hourCycle: SupportedHourCycle) {
  switch (hourCycle) {
    case "h11":
      return hour % 12
    case "h12":
      return hour % 12 === 0 ? 12 : hour % 12
    case "h24":
      return hour === 0 ? 24 : hour
    case "h23":
    default:
      return hour
  }
}

/** Normalizes a nullable time value to a concrete `Time` instance. */
export function getBaseTime(value: TimeValue | null) {
  if (!value) {
    return new Time(0, 0)
  }

  return new Time(
    value.hour,
    value.minute,
    value.second,
    "millisecond" in value ? value.millisecond : 0,
  )
}

/** Applies AM/PM selection to produce a 24-hour hour value. */
export function withDayPeriod(hour: number, dayPeriod: DayPeriod) {
  const normalizedHour = hour % 12
  return dayPeriod === dayPeriodPm ? normalizedHour + 12 : normalizedHour
}

/** Pads a numeric segment for display (e.g. minutes). */
export function formatTimeOption(value: number) {
  return String(value).padStart(2, "0")
}

/** Returns the first year on the current 12-year chooser page. */
export function getYearPageStart(year: number) {
  return Math.floor((year - 1) / 12) * 12 + 1
}

function normalizeDigits(raw: string, locale: string) {
  const formatter = new Intl.NumberFormat(locale, { useGrouping: false })
  let normalized = raw

  for (let digit = 0; digit <= 9; digit += 1) {
    const localizedDigit = formatter.format(digit)
    if (localizedDigit !== String(digit)) {
      normalized = normalized.split(localizedDigit).join(String(digit))
    }
  }

  return normalized
}

function normalizeTimeInput(raw: string, locale: string) {
  return normalizeDigits(raw.normalize("NFKC"), locale)
    .replace(/[\u200e\u200f\u061c]/g, "")
    .trim()
}

function normalizeDayPeriodToken(raw: string, locale: string) {
  return normalizeTimeInput(raw, locale)
    .toLocaleLowerCase(locale)
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function hasDayPeriodToken(raw: string, locale: string, tokens: string[]) {
  const normalizedSource = normalizeDayPeriodToken(raw, locale)
  return tokens.some((token) => {
    const normalizedToken = normalizeDayPeriodToken(token, locale)
    return normalizedToken.length > 0 && normalizedSource.includes(normalizedToken)
  })
}

/** Parses typed time strings (ISO or localized h:mm with optional day period). */
export function parseTimeInputFromUser(
  raw: string,
  {
    hour12,
    locale,
    dayPeriodLabels,
  }: {
    hour12: boolean
    locale: string
    dayPeriodLabels: ReturnType<typeof resolveDayPeriodLabels>
  },
): Time | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const normalizedInput = normalizeTimeInput(trimmed, locale)
  const isoCandidate =
    normalizedInput.startsWith("T") || normalizedInput.startsWith("t")
      ? normalizedInput.slice(1)
      : normalizedInput

  let isoTime: Time | null = null
  try {
    isoTime = parseTime(isoCandidate)
  } catch {
    isoTime = null
  }
  if (isoTime) {
    return isoTime
  }

  const segments = normalizedInput.match(/\d+/g)
  if (!segments || segments.length < 2 || segments.length > 3) {
    return null
  }

  const [hourPart, minutePart, secondPart] = segments
  if (minutePart.length !== 2 || (secondPart && secondPart.length !== 2)) {
    return null
  }

  let hour = Number(hourPart)
  const minute = Number(minutePart)
  const second = secondPart ? Number(secondPart) : 0
  const isPm = hasDayPeriodToken(trimmed, locale, [dayPeriodLabels.pm, "PM"])
  const isAm = hasDayPeriodToken(trimmed, locale, [dayPeriodLabels.am, "AM"])

  if (hour12) {
    if (isPm && hour < 12) {
      hour += 12
    }
    if (isAm && hour === 12) {
      hour = 0
    }
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null
  }

  return new Time(hour, minute, second)
}

/** Shifts a time by whole minutes, wrapping within a single day. */
export function adjustWallClockMinutes(value: Time, deltaMinutes: number): Time {
  let total = value.hour * 60 + value.minute + deltaMinutes
  total = ((total % 1440) + 1440) % 1440
  return new Time(Math.floor(total / 60), total % 60, value.second, value.millisecond)
}
