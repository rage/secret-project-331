import type { CreditRegistrationCourseStats } from "@/generated/api/types.generated"

/** The id the `course_id` filters take for a Courses tab row: its course, or the mooc.fi target. */
export const courseFacetId = (unit: CreditRegistrationCourseStats): string =>
  unit.course_id ?? unit.credit_unit_id

/**
 * One option per course and per mooc.fi target. A course can have several modules, and a
 * Select with two options of the same value refuses to render at all.
 */
export const courseFacetOptions = (
  units: readonly CreditRegistrationCourseStats[],
): { value: string; label: string }[] => {
  const labels = new Map<string, string>()
  for (const unit of units) {
    labels.set(courseFacetId(unit), unit.course_name)
  }
  return Array.from(labels, ([value, label]) => ({ value, label }))
}
