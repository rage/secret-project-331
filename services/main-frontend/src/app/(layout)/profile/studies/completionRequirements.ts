import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"

/**
 * The thresholds an automatic completion measures a student against, as one phrase: "40 points and
 * 25 attempted exercises". Each threshold carries its own plural and the reader's language decides
 * how the two are joined, so neither can be built by concatenation.
 *
 * Returns an empty string when the module sets no threshold; the caller decides what to show then.
 */
export const completionThresholdList = (
  t: CreditRegistrationTFunction,
  language: string,
  pointsRequired: number | null,
  attemptedExercisesRequired: number | null,
): string => {
  const thresholds: string[] = []
  if (pointsRequired !== null) {
    thresholds.push(t("n-points", { count: pointsRequired }))
  }
  if (attemptedExercisesRequired !== null) {
    thresholds.push(t("n-attempted-exercises", { count: attemptedExercisesRequired }))
  }
  return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(thresholds)
}
