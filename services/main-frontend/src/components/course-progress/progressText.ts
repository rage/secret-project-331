import type { TFunction } from "i18next"

import { formatPoints, hasThreshold } from "@/utils/completionThresholds"

/** What a progress chart counts. */
export type ProgressUnit = "points" | "exercises"

/** Named `ProgressUnit` values, for JSX where literal strings are linted. */
export const PROGRESS_UNIT = {
  POINTS: "points",
  EXERCISES: "exercises",
} as const satisfies Record<string, ProgressUnit>

/** One measure of a user's progress; `null` means the course does not define that number. */
export interface ProgressMeasure {
  given: number | null
  max: number | null
  /** Threshold in the same unit as `given`; `null` when there is none. */
  required: number | null
}

/** `measure` with a threshold of 0 treated as none, which is how completion treats it. */
export function withoutEmptyThreshold(measure: ProgressMeasure): ProgressMeasure {
  return hasThreshold(measure.required) ? measure : { ...measure, required: null }
}

/** A chart only makes sense against a positive maximum. */
export function hasChartMax(max: number | null): max is number {
  return max !== null && max > 0
}

/** Which part of a chart a tooltip line explains, and so which colour its dot has. */
export type ChartPart = "given" | "required" | "max"

/** One line of a chart's tooltip. */
export interface ChartExplanation {
  part: ChartPart
  text: string
}

/** What a chart says to screen readers and in its tooltip, so the two cannot disagree. */
export interface ProgressText {
  valueText: string
  explanations: ChartExplanation[]
}

/**
 * Builds the strings for one chart. `requiresExam` switches the threshold wording to exam
 * eligibility. Plural forms follow `max` (or `given` when there is no maximum).
 */
export function describeProgress(
  unit: ProgressUnit,
  measure: ProgressMeasure,
  t: TFunction,
  locale: string | undefined,
  requiresExam: boolean,
): ProgressText {
  const format = (value: number) => formatPoints(value, locale)
  const givenCount = measure.given ?? 0
  const given = format(givenCount)
  const max = hasChartMax(measure.max) ? measure.max : null
  const required = measure.required === null ? null : format(measure.required)

  let valueText =
    unit === "points"
      ? t("progress-points-given", { given, count: givenCount })
      : t("progress-exercises-given", { given, count: givenCount })
  if (max !== null) {
    const values = { given, max: format(max), count: max }
    valueText =
      unit === "points"
        ? t("progress-points-valuetext", values)
        : t("progress-exercises-valuetext", values)
  }

  const explanations: ChartExplanation[] = [
    {
      part: "given",
      text:
        unit === "points"
          ? t("progress-your-points", { given })
          : t("progress-exercises-attempted", { given }),
    },
  ]
  if (required !== null) {
    explanations.push({
      part: "required",
      text: requiresExam
        ? t("progress-required-for-exam", { required })
        : t("progress-required-for-completion", { required }),
    })
  }
  if (max !== null) {
    explanations.push({
      part: "max",
      text: t("progress-maximum", { max: format(max) }),
    })
  }

  return { valueText, explanations }
}
