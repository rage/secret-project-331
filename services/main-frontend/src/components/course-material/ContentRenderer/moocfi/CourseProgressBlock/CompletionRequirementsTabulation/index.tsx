"use client"

import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { helpButtonCss, progressColors } from "@/components/course-progress/progressTheme"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Tooltip } from "@/shared-module/components"

import HighlightItem from "./HilightItem"

const HighlightContainer = styled.div`
  display: flex;
  flex-direction: row;
  padding: 1rem 0;
`

export interface CompletionRequirementsTabulationProps {
  attemptedExercisesRequiredForCompletion: number | null
  pointsRequiredForCompletion: number | null
  /** The thresholds only grant exam eligibility, which the heading and intro then say. */
  requiresExam: boolean
}

/** The module's thresholds as big numbers under a heading; nothing when there are none. */
const CompletionRequirementsTabulation: React.FC<
  React.PropsWithChildren<CompletionRequirementsTabulationProps>
> = ({ attemptedExercisesRequiredForCompletion, pointsRequiredForCompletion, requiresExam }) => {
  const { t } = useTranslation()
  const requirementCount = [pointsRequiredForCompletion, attemptedExercisesRequiredForCompletion]
    .map(Boolean)
    .filter(Boolean).length
  if (requirementCount === 0) {
    return null
  }
  let intro =
    requirementCount > 1
      ? t("requirements-intro-complete-many")
      : t("requirements-intro-complete-one")
  if (requiresExam) {
    intro =
      requirementCount > 1 ? t("requirements-intro-exam-many") : t("requirements-intro-exam-one")
  }
  return (
    <>
      <div className={headingRowCss}>
        <h2 className={headingCss}>
          {requiresExam ? t("heading-exam-requirements") : t("heading-completion-requirements")}
        </h2>
        <Tooltip
          aria-label={
            requiresExam
              ? t("label-about-exam-requirements")
              : t("label-about-completion-requirements")
          }
          placement={BELOW}
          className={cx(helpButtonCss, headingHelpCss)}
        >
          {intro}
        </Tooltip>
      </div>
      <HighlightContainer>
        {!!pointsRequiredForCompletion && (
          <HighlightItem
            highlightColor={baseTheme.colors.gradient["green"]}
            highlightDescription={t("label-points")}
            highlightText={pointsRequiredForCompletion}
          />
        )}
        {!!attemptedExercisesRequiredForCompletion && (
          <HighlightItem
            highlightColor={baseTheme.colors.gradient["blue"]}
            highlightDescription={t("attempted-exercises")}
            highlightText={attemptedExercisesRequiredForCompletion}
            leftBorder={!!pointsRequiredForCompletion}
          />
        )}
      </HighlightContainer>
    </>
  )
}

export default CompletionRequirementsTabulation

// Above, it would cover the button to the exercise list.
const BELOW = "bottom" as const

// Inline, so the ? follows the heading's last word even when the heading wraps.
const headingRowCss = css`
  margin: 0 2rem;
  /* Padding, not margin: a top margin would escape the unpadded panel and open a gap above it. */
  padding-block: 1.5rem 0.6rem;
  border-block-end: 3px solid ${progressColors.rule};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

const headingHelpCss = css`
  margin-inline-start: 0.3rem;
  vertical-align: 0.1em;
`

const headingCss = css`
  display: inline;
  margin: 0;
  font: 500 1.2rem ${headingFont};
  color: ${progressColors.heading};

  ${respondToOrLarger.xxs} {
    font-size: 1.3rem;
  }

  ${respondToOrLarger.sm} {
    font-size: 1.6rem;
  }

  @media (forced-colors: active) {
    color: CanvasText;
  }
`
