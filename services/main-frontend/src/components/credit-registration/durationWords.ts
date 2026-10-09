import type { CreditRegistrationTFunction } from "./constants"

const SECS_PER_MINUTE = 60
const SECS_PER_HOUR = 3600
const SECS_PER_DAY = 86400
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24

const minutes = (t: CreditRegistrationTFunction, count: number) =>
  t("credit-registration-duration-minutes", { count })
const hours = (t: CreditRegistrationTFunction, count: number) =>
  t("credit-registration-duration-hours", { count })
const days = (t: CreditRegistrationTFunction, count: number) =>
  t("credit-registration-duration-days", { count })

/**
 * The gap between two moments in full words, rounded down to its largest unit: "3 minutes",
 * "22 hours", "2 days". See `formatIntervalInWords` for a span read as a setting or a measurement.
 */
export const formatDurationInWords = (t: CreditRegistrationTFunction, secs: number): string => {
  if (secs < SECS_PER_MINUTE) {
    return t("credit-registration-admin-journey-under-a-minute")
  }
  if (secs < SECS_PER_HOUR) {
    return minutes(t, Math.floor(secs / SECS_PER_MINUTE))
  }
  if (secs < SECS_PER_DAY) {
    return hours(t, Math.floor(secs / SECS_PER_HOUR))
  }
  return days(t, Math.floor(secs / SECS_PER_DAY))
}

/**
 * A span in full words to the nearest minute, its two largest units at most: "30 seconds",
 * "15 minutes", "1 hour 30 minutes", "2 days 4 hours".
 */
export const formatIntervalInWords = (t: CreditRegistrationTFunction, secs: number): string => {
  const wholeSecs = Math.round(secs)
  if (wholeSecs < SECS_PER_MINUTE) {
    return t("credit-registration-duration-seconds", { count: wholeSecs })
  }
  const totalMinutes = Math.round(secs / SECS_PER_MINUTE)
  const wholeDays = Math.floor(totalMinutes / (24 * 60))
  const wholeHours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const restMinutes = totalMinutes % 60
  const pair = (larger: string, smaller: string | null) =>
    smaller === null ? larger : t("credit-registration-duration-pair", { larger, smaller })
  if (wholeDays > 0) {
    return pair(days(t, wholeDays), wholeHours > 0 ? hours(t, wholeHours) : null)
  }
  if (wholeHours > 0) {
    return pair(hours(t, wholeHours), restMinutes > 0 ? minutes(t, restMinutes) : null)
  }
  return minutes(t, restMinutes)
}

const MINUTE_MS = SECS_PER_MINUTE * 1000
const HOUR_MS = SECS_PER_HOUR * 1000
const DAY_MS = SECS_PER_DAY * 1000

/** How far ahead a future moment is, in whole units of the UI `language`: "in 5 minutes", "tomorrow". */
export const formatFutureInWords = (at: Date, language: string): string => {
  const ms = at.getTime() - Date.now()
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" })
  const wholeMinutes = Math.round(ms / MINUTE_MS)
  if (wholeMinutes < MINUTES_PER_HOUR) {
    return format.format(Math.max(1, wholeMinutes), "minute")
  }
  const wholeHours = Math.round(ms / HOUR_MS)
  if (wholeHours < HOURS_PER_DAY) {
    return format.format(wholeHours, "hour")
  }
  return format.format(Math.round(ms / DAY_MS), "day")
}
