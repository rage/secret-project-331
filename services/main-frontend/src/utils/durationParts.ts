const SECS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

/** A span rounded to the nearest minute, as whole days, then the hours and minutes left over. */
export function daysHoursMinutes(secs: number): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.round(secs / SECS_PER_MINUTE)
  return {
    days: Math.floor(totalMinutes / MINUTES_PER_DAY),
    hours: Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
  }
}
