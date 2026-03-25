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

/** Parses typed time strings (ISO or common h:mm with optional am/pm). */
export function parseTimeInputFromUser(raw: string, hour12: boolean): Time | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    let hour = Number(match[1])
    const minute = Number(match[2])
    const second = match[3] ? Number(match[3]) : 0
    if (hour12) {
      const upper = trimmed.toUpperCase()
      const isPm = upper.includes("PM")
      const isAm = upper.includes("AM")
      if (isPm && hour < 12) {
        hour += 12
      }
      if (isAm && hour === 12) {
        hour = 0
      }
    }
    return new Time(hour, minute, second)
  }

  try {
    return parseTime(trimmed.includes("T") ? trimmed : `T${trimmed}`)
  } catch {
    return null
  }
}

/** Shifts a time by whole minutes, wrapping within a single day. */
export function adjustWallClockMinutes(value: Time, deltaMinutes: number): Time {
  let total = value.hour * 60 + value.minute + deltaMinutes
  total = ((total % 1440) + 1440) % 1440
  return new Time(Math.floor(total / 60), total % 60, value.second, value.millisecond)
}
