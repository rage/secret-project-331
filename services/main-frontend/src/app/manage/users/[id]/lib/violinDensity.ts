// Geometry for the cross-course timeline's submission-density violins. Turns a course's per-module
// daily submission counts into stacked, exercise-count-normalized density layers on a shared day axis,
// so each lane can be drawn as a symmetric violin whose bulges are busy days and whose flats are pauses.

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
// Above this many daily buckets the path is downsampled to weekly bins so a long-running course stays
// cheap to draw. (~13 months of daily buckets.)
const MAX_DAILY_BUCKETS = 400

export interface CourseSpan {
  enrolledMs: number
  /** Enrollment, or the last submission/completion — whichever is latest. */
  lastActivityMs: number
  /** True once the user has any submission or completion in the course. */
  hasActivity: boolean
}

/** Enrollment→last-activity span used for lane packing and the faint track (submissions included). */
export function courseSpan(enrollment: CourseEnrollmentInfo): CourseSpan {
  const enrolledMs = Date.parse(enrollment.first_enrolled_at)
  const events: number[] = [
    ...enrollment.course_module_completions.map((c) => Date.parse(c.completion_date)),
    ...enrollment.course_modules.flatMap((m) => m.daily_submissions.map((d) => Date.parse(d.day))),
  ]
  const hasActivity = events.length > 0
  const lastActivityMs = events.reduce((mx, ms) => Math.max(mx, ms), enrolledMs)
  return { enrolledMs, lastActivityMs, hasActivity }
}

export interface DensityLayer {
  /** Module order index → palette color (base module = 0). */
  colorIndex: number
  /** Cumulative half-height (submissions per exercise, this module + all lower ones), aligned to `days`. */
  cumulative: number[]
}

export interface DayActivity {
  ms: number
  total: number
  /** Modules active this bucket; `name === null` is the base module. */
  breakdown: { name: string | null; count: number }[]
}

export interface CourseDensity {
  /** Bucket start timestamps (ascending, zero-filled), daily unless downsampled to weekly. */
  days: number[]
  weekly: boolean
  /** Modules with submissions, in order; last layer is the outer violin boundary. */
  layers: DensityLayer[]
  /** Non-empty buckets only, for per-day tooltips. */
  activeDays: DayActivity[]
}

/**
 * Per-module daily submission counts → stacked density layers on a shared day axis. Returns `null` when
 * the course has no submissions (the caller keeps the solid track / no-activity diamond instead).
 */
export function buildCourseDensity(enrollment: CourseEnrollmentInfo): CourseDensity | null {
  const modules = enrollment.course_modules.toSorted((a, b) => a.order_number - b.order_number)
  const bucketMsList = modules.flatMap((m) => m.daily_submissions.map((d) => Date.parse(d.day)))
  if (bucketMsList.length === 0) {
    return null
  }

  const minBucket = bucketMsList.reduce((mn, ms) => Math.min(mn, ms), Infinity)
  const maxBucket = bucketMsList.reduce((mx, ms) => Math.max(mx, ms), -Infinity)
  const enrolledMs = Date.parse(enrollment.first_enrolled_at)
  const maxCompletion = enrollment.course_module_completions.reduce(
    (mx, c) => Math.max(mx, Date.parse(c.completion_date)),
    0,
  )

  // Server DATE_TRUNC day boundaries may be phase-shifted from UTC midnight; keep that phase so the
  // client axis lands exactly on the returned bucket timestamps.
  const phase = ((minBucket % DAY_MS) + DAY_MS) % DAY_MS
  const alignFloor = (ms: number): number => Math.floor((ms - phase) / DAY_MS) * DAY_MS + phase

  const startMs = alignFloor(Math.min(enrolledMs, minBucket))
  const endMs = alignFloor(Math.max(maxBucket, maxCompletion, enrolledMs))
  const weekly = Math.round((endMs - startMs) / DAY_MS) + 1 > MAX_DAILY_BUCKETS
  const step = weekly ? WEEK_MS : DAY_MS
  const nBins = Math.floor((endMs - startMs) / step) + 1
  const binOf = (ms: number): number => Math.floor((alignFloor(ms) - startMs) / step)

  const days = Array.from({ length: nBins }, (_, i) => startMs + i * step)
  const cumulative = Array.from({ length: nBins }, () => 0)
  const totals = Array.from({ length: nBins }, () => 0)
  const breakdowns: { name: string | null; count: number }[][] = Array.from(
    { length: nBins },
    () => [],
  )
  const layers: DensityLayer[] = []

  modules.forEach((m, i) => {
    const perBin = Array.from({ length: nBins }, () => 0)
    let hasAny = false
    for (const d of m.daily_submissions) {
      const b = binOf(Date.parse(d.day))
      if (b < 0 || b >= nBins) {
        continue
      }
      perBin[b] += d.count
      hasAny = true
    }
    if (!hasAny) {
      return
    }
    const ex = m.exercise_count
    for (let b = 0; b < nBins; b++) {
      if (perBin[b] === 0) {
        continue
      }
      totals[b] += perBin[b]
      breakdowns[b].push({ name: m.name ?? null, count: perBin[b] })
      if (ex > 0) {
        cumulative[b] += perBin[b] / ex
      }
    }
    if (ex > 0) {
      layers.push({ colorIndex: i, cumulative: [...cumulative] })
    }
  })

  const activeDays: DayActivity[] = days
    .map((ms, b) => ({ ms, total: totals[b], breakdown: breakdowns[b] }))
    .filter((d) => d.total > 0)

  return { days, weekly, layers, activeDays }
}

/** Shared vertical scale reference: the tallest stacked (submissions-per-exercise) bucket across lanes. */
export function maxStackedPerExercise(densities: (CourseDensity | null)[]): number {
  let max = 0
  for (const d of densities) {
    const top = d?.layers[d.layers.length - 1]?.cumulative
    if (!top) {
      continue
    }
    for (const v of top) {
      if (v > max) {
        max = v
      }
    }
  }
  return max
}
