import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"

/**
 * Distinct modules passed in this course, restricted to modules that still exist — a completion for
 * a deleted module must not push the count past the total ("2 of 1 modules").
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
