"use client"

import { css } from "@emotion/css"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont, secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { formatPoints } from "@/utils/completionThresholds"

import {
  isRequirementMet,
  PROGRESS_UNITS,
  type ProgressMeasure,
  type ProgressUnit,
} from "./progressText"
import { HEADING_TAG, INLINE_ELEMENT, progressColors, sectionHeadingCss } from "./progressTheme"

/** Both measures, whose thresholds are listed, and how the module is completed. */
export interface CompletionRequirementsProps {
  points: ProgressMeasure
  exercises: ProgressMeasure
  /** Names the section landmark, so a page with several modules has distinct regions. */
  moduleName: string
  /** The thresholds only grant exam eligibility; the course is completed by passing the exam. */
  requiresExam: boolean
  /** False when the course staff decide completion; the thresholds are then not listed. */
  automaticCompletion: boolean
  headingLevel: 2 | 3
}

/**
 * What must be met to complete the module (or to take its exam), one big number per threshold.
 * Renders nothing when completion is automatic with neither a threshold nor an exam.
 */
const CompletionRequirements: React.FC<CompletionRequirementsProps> = ({
  points,
  exercises,
  moduleName,
  requiresExam,
  automaticCompletion,
  headingLevel,
}) => {
  const { t, i18n } = useTranslation()
  const Heading = HEADING_TAG[headingLevel]
  const measures: Record<ProgressUnit, ProgressMeasure> = { points, exercises }
  const units = PROGRESS_UNITS.filter((unit) => measures[unit].required !== null)
  const hasList = automaticCompletion && units.length > 0
  if (automaticCompletion && !hasList && !requiresExam) {
    return null
  }
  const isExamUnlocked = hasList && units.every((unit) => isRequirementMet(measures[unit]))

  let intro = t("requirements-intro-complete-many")
  if (requiresExam) {
    intro = units.length > 1 ? t("requirements-intro-exam-many") : t("requirements-intro-exam-one")
  } else if (units.length === 1) {
    intro = t("requirements-intro-complete-one")
  }

  return (
    <section
      aria-label={
        requiresExam
          ? t("label-exam-requirements-for-module", { module: moduleName })
          : t("label-completion-requirements-for-module", { module: moduleName })
      }
      className={rootCss}
    >
      <Heading className={sectionHeadingCss}>
        {requiresExam ? t("heading-exam-requirements") : t("heading-completion-requirements")}
      </Heading>
      {hasList && (
        <>
          <p className={introCss}>{intro}</p>
          <ul className={listCss}>
            {units.map((unit) => {
              const isMet = isRequirementMet(measures[unit])
              return (
                <li key={unit} className={itemCss}>
                  <span className={unit === "points" ? pointsNumberCss : exercisesNumberCss}>
                    <bdi>{formatPoints(measures[unit].required ?? 0, i18n.language)}</bdi>
                  </span>{" "}
                  <span className={labelCss}>
                    {unit === "points" ? t("label-points") : t("exercises-attempted")}
                    {isMet && <CheckIcon />}
                  </span>
                  {isMet && (
                    <VisuallyHidden elementType={INLINE_ELEMENT}>
                      {", "}
                      {t("requirement-met")}
                    </VisuallyHidden>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {automaticCompletion && requiresExam && (
        <p className={noteCss}>
          {isExamUnlocked ? t("requirements-exam-unlocked") : t("requirements-exam-pending")}
        </p>
      )}
      {!automaticCompletion && <p className={noteCss}>{t("note-graded-by-your-teacher")}</p>}
    </section>
  )
}

export default CompletionRequirements

const CheckIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={checkCss}>
    <path d="M3 8.5l3 3 7-7" className={checkPathCss} />
  </svg>
)

const rootCss = css`
  padding: 1.5rem 2rem;
  font-family: ${secondaryFont};
  color: ${progressColors.text};

  @media (forced-colors: active) {
    color: CanvasText;
  }
`

const introCss = css`
  margin: 0;
  text-align: center;
  font-size: 1.05rem;

  ${respondToOrLarger.md} {
    font-size: 18px;
  }
`

const listCss = css`
  display: flex;
  flex-direction: column;
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;

  ${respondToOrLarger.sm} {
    flex-direction: row;
  }
`

const itemCss = css`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 1.5em;
  text-align: center;

  & + & {
    border-block-start: 2px solid ${progressColors.divider};

    ${respondToOrLarger.sm} {
      border-block-start: 0;
      border-inline-start: 2px solid ${progressColors.divider};
    }

    @media (forced-colors: active) {
      border-color: CanvasText;
    }
  }
`

const bigNumberCss = (gradient: string) => css`
  position: relative;
  font-family: ${headingFont};
  font-size: 3.125rem;
  font-weight: 700;
  line-height: 1.2;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-image: ${gradient};

  @media (forced-colors: active) {
    background: none;
    -webkit-text-fill-color: CanvasText;
    color: CanvasText;
  }
`

// Deliberately the original gradients, although their light ends fall below 3:1.
const pointsNumberCss = bigNumberCss(baseTheme.colors.gradient.green)
const exercisesNumberCss = bigNumberCss(baseTheme.colors.gradient.blue)

const labelCss = css`
  position: relative;
  display: inline-block;
  margin-block-start: 0.25rem;
  font: 500 15px/1.3 ${headingFont};
  color: ${progressColors.mutedText};

  ${respondToOrLarger.md} {
    font-size: 18px;
  }

  @media (forced-colors: active) {
    color: CanvasText;
  }
`

// Hangs past the label's end, so the label stays centred under its number.
const checkCss = css`
  position: absolute;
  inset-inline-start: 100%;
  top: 50%;
  width: 1.05em;
  height: 1.05em;
  margin-inline-start: 0.3em;
  translate: 0 -50%;
  color: ${progressColors.fill};

  @media (forced-colors: active) {
    color: CanvasText;
  }
`

const checkPathCss = css`
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
`

const noteCss = css`
  margin: 1rem 0 0;
  text-align: center;
  font-size: 1rem;
  text-wrap: pretty;
`
