import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
import type { MyStudiesCourseModule } from "@/generated/api/types.generated"

/** Whether the student has passed every module there is, which is what completes a course. */
export const everyModulePassed = (modules: MyStudiesCourseModule[]): boolean =>
  modules.length > 0 && modules.every((module) => module.completion?.passed === true)

/** What a module still asks of the student, or `null` once every threshold is met. */
export interface RemainingRequirements {
  points: number | null
  attemptedExercises: number | null
}

/** Rounds away the float noise two decimals of stored points leave behind in a subtraction. */
const shortfall = (required: number | null, current: number): number | null => {
  if (required === null) {
    return null
  }
  const remaining = Math.round((required - current) * 100) / 100
  return remaining > 0 ? remaining : null
}

export const remainingRequirements = (
  pointsRequired: number | null,
  pointsGiven: number,
  attemptedExercisesRequired: number | null,
  attemptedExercises: number,
): RemainingRequirements | null => {
  const points = shortfall(pointsRequired, pointsGiven)
  const attemptedExercises_ = shortfall(attemptedExercisesRequired, attemptedExercises)
  if (points === null && attemptedExercises_ === null) {
    return null
  }
  return { points, attemptedExercises: attemptedExercises_ }
}

/**
 * What is left as one phrase: "12 more points and 3 more exercises". Each part carries its own
 * plural and the reader's language decides how the two are joined, so neither can be built by
 * concatenation.
 */
export const remainingRequirementsList = (
  t: CreditRegistrationTFunction,
  language: string,
  remaining: RemainingRequirements,
): string => {
  const parts: string[] = []
  if (remaining.points !== null) {
    parts.push(t("n-more-points", { count: remaining.points }))
  }
  if (remaining.attemptedExercises !== null) {
    parts.push(t("n-more-attempted-exercises", { count: remaining.attemptedExercises }))
  }
  return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(parts)
}
