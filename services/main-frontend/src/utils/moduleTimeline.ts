// Per-module timeline helpers shared by the cross-course Gantt and the per-course timeline. No module
// "start" is stored, so an additional (non-base) module's start is inferred from its first submission
// (`first_submission_at` on the enrollment DTO); the base module starts at enrollment.

import type { TFunction } from "i18next"

import type { CourseEnrollmentInfo, CourseModuleInfo } from "@/generated/api/types.generated"

/** Whole seconds between two instants, clamped at 0. */
export function durationSeconds(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000))
}

/** Localized, day-aware duration: `Xd` / `Xd Yh` / `Xh Ym` / `Ym`. */
export function formatDuration(seconds: number, t: TFunction): string {
  const totalMinutes = Math.round(seconds / 60)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) {
    return hours > 0 ? t("duration-days-hours", { days, hours }) : t("duration-days", { days })
  }
  if (hours > 0) {
    return t("duration-hours-minutes", { hours, minutes })
  }
  return t("duration-minutes", { minutes })
}

/** The base (default) module has no name. */
export function isBaseModule(m: Pick<CourseModuleInfo, "name">): boolean {
  return m.name === null || m.name === undefined
}

export interface ModuleRow {
  moduleId: string
  name: string | null
  isBase: boolean
  startedAt: Date | null
  completedAt: Date | null
  needsReview: boolean
  /** Started → Completed for this module; `null` until both are known. */
  moduleSeconds: number | null
  /** Enrollment → Completed; `null` until completed. */
  sinceEnrollSeconds: number | null
}

/** One row per module (ordered by `order_number`) with inferred start, completion and durations. */
export function computeModuleRows(enrollment: CourseEnrollmentInfo): ModuleRow[] {
  const enrolledAt = new Date(enrollment.first_enrolled_at)
  const modules = enrollment.course_modules.toSorted((a, b) => a.order_number - b.order_number)
  return modules.map((m) => {
    const isBase = isBaseModule(m)
    // A module can be completed more than once and the API list has no guaranteed order; pick the latest
    // completion deterministically so the row's date, needs-review flag and durations are stable.
    const moduleCompletions = enrollment.course_module_completions
      .filter((c) => c.course_module_id === m.id)
      .toSorted(
        (a, b) => new Date(a.completion_date).getTime() - new Date(b.completion_date).getTime(),
      )
    const completion = moduleCompletions[moduleCompletions.length - 1]
    const startedAt = isBase
      ? enrolledAt
      : m.first_submission_at
        ? new Date(m.first_submission_at)
        : null
    const completedAt = completion ? new Date(completion.completion_date) : null
    return {
      moduleId: m.id,
      name: m.name ?? null,
      isBase,
      startedAt,
      completedAt,
      needsReview: completion?.needs_to_be_reviewed ?? false,
      moduleSeconds: startedAt && completedAt ? durationSeconds(startedAt, completedAt) : null,
      sinceEnrollSeconds: completedAt ? durationSeconds(enrolledAt, completedAt) : null,
    }
  })
}
