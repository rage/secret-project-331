import type { TFunction } from "i18next"

import { formatPoints, hasThreshold, meetsThreshold } from "@/utils/completionThresholds"

/** What a progress section counts. */
export type ProgressUnit = "points" | "exercises"

/** Named `ProgressUnit` values, for JSX where literal strings are linted. */
export const PROGRESS_UNIT = {
  POINTS: "points",
  EXERCISES: "exercises",
} as const satisfies Record<string, ProgressUnit>

/** Every unit, in the order the card shows them. */
export const PROGRESS_UNITS: readonly ProgressUnit[] = [
  PROGRESS_UNIT.POINTS,
  PROGRESS_UNIT.EXERCISES,
]

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

/** True when the measure has a threshold and `given` reaches it. */
export function isRequirementMet({ given, required }: ProgressMeasure): boolean {
  return required !== null && meetsThreshold(required, given ?? 0)
}

/** A chart only makes sense against a positive maximum. */
export function hasChartMax(max: number | null): max is number {
  return max !== null && max > 0
}

/** `value` as a fraction of `max`, clamped to [0, 1]; 0 when `max` is not positive. */
export function toRatio(value: number, max: number): number {
  return max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
}

/** Every string one measure shows, so the chart, its key and its tooltip cannot disagree. */
export interface ProgressText {
  summary: string
  valueText: string
  /** `null` when the measure has no threshold. */
  requiredText: string | null
  tooltipLines: string[]
  /** Formatted threshold drawn next to the chart's tick; `null` without one. */
  tickLabel: string | null
}

/**
 * Builds the strings for one measure. `requiresExam` switches the threshold wording to exam
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

  const givenOnly =
    unit === "points"
      ? t("progress-points-given", { given, count: givenCount })
      : t("progress-exercises-given", { given, count: givenCount })
  let summary = givenOnly
  let valueText = givenOnly
  if (max !== null) {
    const values = { given, max: format(max), count: max }
    summary =
      unit === "points"
        ? t("progress-points-summary", values)
        : t("progress-exercises-summary", values)
    valueText =
      unit === "points"
        ? t("progress-points-valuetext", values)
        : t("progress-exercises-valuetext", values)
  }

  const tooltipLines = [
    unit === "points"
      ? t("progress-your-points", { given })
      : t("progress-exercises-attempted", { given }),
  ]
  if (required !== null) {
    tooltipLines.push(
      requiresExam
        ? t("progress-required-for-exam", { required })
        : t("progress-required-for-completion", { required }),
    )
  }
  if (max !== null) {
    tooltipLines.push(
      unit === "points"
        ? t("progress-maximum", { max: format(max) })
        : t("progress-total", { max: format(max) }),
    )
  }

  let requiredText: string | null = null
  if (required !== null) {
    requiredText = requiresExam
      ? t("progress-required-for-exam", { required })
      : t("progress-required", { required })
  }

  return { summary, valueText, requiredText, tooltipLines, tickLabel: required }
}
