"use client"

import { css, cx } from "@emotion/css"

import { headingFont } from "@/shared-module/common/styles"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"

import { CHART_SIZE } from "./chartProps"
import CompletionRequirements from "./CompletionRequirements"
import ProgressSection from "./ProgressSection"
import { PROGRESS_UNIT, type ProgressMeasure, withoutEmptyThreshold } from "./progressText"
import { progressColors } from "./progressTheme"

interface ProgressCardBaseProps {
  points: ProgressMeasure
  exercises: ProgressMeasure
}

interface ModuleProgressCardProps extends ProgressCardBaseProps {
  variant: "module"
  /** Level of every section heading; the first one is also listed in the heading navigation. */
  headingLevel: 2 | 3
  moduleName: string
  /** The thresholds only grant exam eligibility; the course is completed by passing the exam. */
  requiresExam: boolean
  /** False when the course staff decide completion. */
  automaticCompletion: boolean
}

interface ChapterProgressCardProps extends ProgressCardBaseProps {
  variant: "chapter"
  /** Card title, an h2 listed in the page's heading navigation. */
  title: string
  /** The sections sit under the h2 title. */
  headingLevel: 3
}

/** `module` lists the completion requirements under the charts; `chapter` shows charts only. */
export type ProgressCardProps = ModuleProgressCardProps | ChapterProgressCardProps

/** A user's points donut and exercises bar on one panel, with the module's requirements. */
const ProgressCard: React.FC<ProgressCardProps> = (props) => {
  const { headingLevel } = props
  const points = withoutEmptyThreshold(props.points)
  const exercises = withoutEmptyThreshold(props.exercises)
  const isModule = props.variant === "module"
  const size = isModule ? CHART_SIZE.REGULAR : CHART_SIZE.SMALL
  const requiresExam = isModule && props.requiresExam
  const sectionProps = { size, headingLevel, requiresExam } as const
  return (
    <div className={panelCss}>
      {props.variant === "chapter" && (
        <h2 className={cx(INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS, titleCss)}>
          {props.title}
        </h2>
      )}
      <ProgressSection
        unit={PROGRESS_UNIT.POINTS}
        measure={points}
        isInHeadingNavigation={isModule}
        {...sectionProps}
      />
      <ProgressSection
        unit={PROGRESS_UNIT.EXERCISES}
        measure={exercises}
        isInHeadingNavigation={false}
        {...sectionProps}
      />
      {props.variant === "module" && (
        <CompletionRequirements
          points={points}
          exercises={exercises}
          moduleName={props.moduleName}
          requiresExam={props.requiresExam}
          automaticCompletion={props.automaticCompletion}
          headingLevel={headingLevel}
        />
      )}
    </div>
  )
}

export default ProgressCard

const panelCss = css`
  background: ${progressColors.panel};

  @media (forced-colors: active) {
    background: Canvas;
  }
`

const titleCss = css`
  margin: 0;
  padding: 2rem 2rem 0;
  text-align: center;
  font: 500 1.8rem ${headingFont};
  color: ${progressColors.heading};

  @media (forced-colors: active) {
    color: CanvasText;
  }
`
