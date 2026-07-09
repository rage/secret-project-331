/**
 * Duration helpers for the user-details page. Per-module durations are not stored — only each
 * module's completion timestamp and a course-level total — so the module breakdown derives durations
 * from `completion_date` relative to enrollment (cumulative) and to the previous completion (gap).
 * These functions are pure and return numbers; unit strings are formatted in components via i18n.
 */

/** Whole seconds between two instants, clamped at 0 (never negative). */
export function durationSeconds(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000))
}

/** Split a duration into whole hours and remaining whole minutes (rounded to the nearest minute). */
export function toHoursMinutes(totalSeconds: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(totalSeconds / 60)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

/** Duration as a one-decimal number of hours (e.g. 1.4). */
export function toHours(totalSeconds: number): number {
  return Math.round((totalSeconds / 3600) * 10) / 10
}

/** `value` as an integer percentage of `max`, clamped to 0–100. Returns 0 when `max <= 0`. */
export function ratioPercent(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)))
}

/**
 * Per-module timing derived from completion timestamps. `sinceEnrollmentSeconds` is cumulative from
 * enrollment; `gapSeconds` is the interval since the previous completion (or from enrollment for the
 * first). Input completions are sorted by completion date ascending.
 */
export interface ModuleTiming<T> {
  completion: T
  completedAt: Date
  sinceEnrollmentSeconds: number
  /** Gap since the previous completion. `null` for the first completion (measured from enrollment). */
  gapSeconds: number | null
}

export function computeModuleTimings<T>(
  completions: T[],
  getCompletedAt: (completion: T) => Date,
  enrolledAt: Date,
): ModuleTiming<T>[] {
  const sorted = [...completions].sort(
    (a, b) => getCompletedAt(a).getTime() - getCompletedAt(b).getTime(),
  )
  return sorted.map((completion, index) => {
    const completedAt = getCompletedAt(completion)
    const previousAt = index === 0 ? null : getCompletedAt(sorted[index - 1])
    return {
      completion,
      completedAt,
      sinceEnrollmentSeconds: durationSeconds(enrolledAt, completedAt),
      gapSeconds: previousAt ? durationSeconds(previousAt, completedAt) : null,
    }
  })
}
