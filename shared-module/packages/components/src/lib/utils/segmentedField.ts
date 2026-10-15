import { parseDate, parseDateTime, parseTime } from "@internationalized/date"
import type { DateValue, TimeValue } from "react-aria"

/** True when the floating label is at rest with no committed value. */
export function shouldHideRestSegmentPlaceholders(
  layout: "floating" | "stacked",
  isFocused: boolean,
  hasValue: boolean,
  isPickerOpen?: boolean,
): boolean {
  if (layout !== "floating") {
    return false
  }

  if (isFocused || hasValue || isPickerOpen === true) {
    return false
  }

  return true
}

export function padNumber(value: number, minimumLength = 2) {
  return String(value).padStart(minimumLength, "0")
}

export function hasDateParts(value: DateValue | TimeValue): value is DateValue & {
  year: number
  month: number
  day: number
} {
  return "year" in value && "month" in value && "day" in value
}

export function hasTimeParts(value: DateValue | TimeValue): value is TimeValue & {
  hour: number
  minute: number
  second: number
} {
  return "hour" in value && "minute" in value && "second" in value
}

export function formatDateValue(value: { year: number; month: number; day: number }) {
  return `${padNumber(value.year, 4)}-${padNumber(value.month)}-${padNumber(value.day)}`
}

export function formatTimeValue(
  value: { hour: number; minute: number; second: number },
  granularity: "hour" | "minute" | "second",
) {
  const hour = padNumber(value.hour)

  if (granularity === "hour") {
    return hour
  }

  const minute = padNumber(value.minute)

  if (granularity === "minute") {
    return `${hour}:${minute}`
  }

  return `${hour}:${minute}:${padNumber(value.second)}`
}

export function parseDateLikeValue(kind: "date" | "datetime", value: string | undefined) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined
  }

  try {
    return kind === "date" ? parseDate(value) : parseDateTime(value)
  } catch {
    return undefined
  }
}

export function parseTimeOnlyValue(value: string | undefined) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined
  }

  try {
    return parseTime(value)
  } catch {
    return undefined
  }
}

export function serializeDateValue(value: DateValue | null) {
  return value && hasDateParts(value) ? formatDateValue(value) : ""
}

export function serializeTimeValue(
  value: TimeValue | null,
  granularity: "hour" | "minute" | "second",
) {
  return value && hasTimeParts(value) ? formatTimeValue(value, granularity) : ""
}

export function serializeDateTimeValue(
  value: DateValue | null,
  granularity: "hour" | "minute" | "second",
) {
  if (!value || !hasDateParts(value) || !hasTimeParts(value)) {
    return ""
  }

  return `${formatDateValue(value)}T${formatTimeValue(value, granularity)}`
}

export function serializeDateLikeInputValue(
  kind: "date" | "datetime",
  value: DateValue | null,
  granularity: "hour" | "minute" | "second",
) {
  return kind === "date" ? serializeDateValue(value) : serializeDateTimeValue(value, granularity)
}

export function resolveMinuteStep(step: string | number | undefined) {
  if (step === undefined || step === "any") {
    return 5
  }

  const numericStep = typeof step === "number" ? step : Number(step)

  if (!Number.isFinite(numericStep) || numericStep <= 0) {
    return 1
  }

  const minuteStep = numericStep / 60

  if (!Number.isInteger(minuteStep) || minuteStep < 1 || minuteStep > 59) {
    return 1
  }

  return minuteStep
}
