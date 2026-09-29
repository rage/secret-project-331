"use client"

import { css, cx } from "@emotion/css"
import { useId } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"
import { formatPoints } from "@/utils/completionThresholds"

import BarProgress from "./BarProgress"
import type { ChartSize } from "./chartProps"
import DonutProgress from "./DonutProgress"
import {
  describeProgress,
  hasChartMax,
  type ProgressMeasure,
  type ProgressUnit,
} from "./progressText"
import { HEADING_TAG, INLINE_ELEMENT, progressColors, sectionHeadingCss } from "./progressTheme"

/** One measure and how its section is titled and sized. */
export interface ProgressSectionProps {
  /** Points get the donut, exercises the bar. */
  unit: ProgressUnit
  measure: ProgressMeasure
  size: ChartSize
  headingLevel: 2 | 3
  /** The threshold only grants exam eligibility; changes the requirement wording. */
  requiresExam: boolean
  /** Lists the heading in the course material's heading navigation. */
  isInHeadingNavigation: boolean
}

/**
 * A heading, one chart and the key strip that states the value and any requirement. The chart is
 * left out when `max` is missing or not positive; the key still states the value.
 */
const ProgressSection: React.FC<ProgressSectionProps> = ({
  unit,
  measure,
  size,
  headingLevel,
  requiresExam,
  isInHeadingNavigation,
}) => {
  const { t, i18n } = useTranslation()
  const headingId = useId()
  const Heading = HEADING_TAG[headingLevel]
  const text = describeProgress(unit, measure, t, i18n.language, requiresExam)
  const max = hasChartMax(measure.max) ? measure.max : null
  // A threshold above the maximum has no place on the chart; the key strip still states it.
  const isTickDrawn = max !== null && measure.required !== null && measure.required <= max
  const chartProps =
    max !== null
      ? {
          value: measure.given ?? 0,
          max,
          required: isTickDrawn ? measure.required : null,
          tickLabel: isTickDrawn ? text.tickLabel : null,
          valueText: text.valueText,
          tooltipLines: text.tooltipLines,
          labelledBy: headingId,
          size,
        }
      : null

  return (
    <div className={cx(rootCss, size === "small" && smallRootCss)}>
      <Heading
        id={headingId}
        className={cx(
          sectionHeadingCss,
          isInHeadingNavigation && INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
        )}
      >
        {unit === "points" ? t("label-points") : t("exercises-attempted")}
      </Heading>
      {chartProps && unit === "points" && (
        <DonutProgress
          {...chartProps}
          centerPrimary={formatPoints(chartProps.value, i18n.language)}
          centerSecondary={t("progress-out-of-max", {
            max: formatPoints(chartProps.max, i18n.language),
          })}
        />
      )}
      {chartProps && unit === "exercises" && <BarProgress {...chartProps} />}
      <p className={keyCss}>
        <span className={summaryCss}>
          <bdi>{text.summary}</bdi>
        </span>
        {text.requiredText && (
          <span>
            {/* The strip separates the two facts with a gap; screen readers get a pause instead. */}
            <VisuallyHidden elementType={INLINE_ELEMENT}>, </VisuallyHidden>
            <bdi>{text.requiredText}</bdi>
          </span>
        )}
      </p>
    </div>
  )
}

export default ProgressSection

const rootCss = css`
  padding: 1.5rem 2rem 1rem;
  font-family: ${secondaryFont};
  color: ${progressColors.text};

  &:last-child {
    padding-block-end: 1.5rem;
  }

  @media (forced-colors: active) {
    color: CanvasText;
  }
`

const smallRootCss = css`
  padding-inline: 1rem;
  padding-block: 0.75rem;
`

const keyCss = css`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.15rem;
  margin: 0.75rem 0 0;
  padding: 0.75rem 1rem;
  background: ${progressColors.keyStrip};
  font-size: 0.95rem;
  text-align: center;

  ${respondToOrLarger.sm} {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
  }

  @media (forced-colors: active) {
    background: Canvas;
    border-block: 1px solid CanvasText;
  }
`

const summaryCss = css`
  font-size: 1rem;
  font-weight: 600;
`
