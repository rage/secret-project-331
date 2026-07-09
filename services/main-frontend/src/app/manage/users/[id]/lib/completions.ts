import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"

/**
 * Modules the student has *passed* in this course, counted distinctly and restricted to modules that
 * still exist. A passed completion for a since-deleted module must not inflate the count past the
 * module total (otherwise the card can read "2 of 1 modules").
 */
export function completedModuleCount(enrollment: CourseEnrollmentInfo): number {
  const existingModuleIds = new Set(enrollment.course_modules.map((m) => m.id))
  return new Set(
    enrollment.course_module_completions
      .filter((c) => c.passed && existingModuleIds.has(c.course_module_id))
      .map((c) => c.course_module_id),
  ).size
}

/** Total completions across the given courses still awaiting cheating review (hidden from the student). */
export function awaitingReviewCount(enrollments: CourseEnrollmentInfo[]): number {
  return enrollments.reduce((sum, e) => sum + e.course_module_completions_needing_review, 0)
}
