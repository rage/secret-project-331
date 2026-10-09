import type { CreditRegistrationTFunction } from "./constants"

const SECS_PER_MINUTE = 60
const SECS_PER_HOUR = 3600
const SECS_PER_DAY = 86400

/**
 * A span in full words, rounded down to its largest unit: "3 minutes", "22 hours", "2 days".
 * `language` is the UI language the unit names are written in.
 */
export const formatDurationInWords = (
  t: CreditRegistrationTFunction,
  secs: number,
  language: string,
): string => {
  if (secs < SECS_PER_MINUTE) {
    return t("credit-registration-admin-journey-under-a-minute")
  }
  const [unit, size] =
    secs < SECS_PER_HOUR
      ? (["minute", SECS_PER_MINUTE] as const)
      : secs < SECS_PER_DAY
        ? (["hour", SECS_PER_HOUR] as const)
        : (["day", SECS_PER_DAY] as const)
  return new Intl.NumberFormat(language, { style: "unit", unit, unitDisplay: "long" }).format(
    Math.floor(secs / size),
  )
}
