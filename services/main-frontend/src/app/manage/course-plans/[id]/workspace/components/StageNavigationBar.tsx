"use client"

import { css, cx } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type { CourseDesignerStage } from "@/services/backend/courseDesigner"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const STATUS_SEPARATOR = " · "

const barWrapperStyles = css`
  display: flex;
  justify-content: flex-end;
  padding: 0 1.5rem 0.5rem;

  ${respondToOrLarger.xl} {
    padding: 0 3rem 0.5rem;
  }
`

const navCardStyles = css`
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 12px;
  background: white;
  border: 1px solid ${baseTheme.colors.gray[200]};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition:
    box-shadow 150ms ease,
    border-color 150ms ease;

  :hover {
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
    border-color: ${baseTheme.colors.green[200]};
  }
`

const tabsRowStyles = css`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
`

const tabStyles = css`
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: ${baseTheme.colors.gray[600]};
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
`

const tabActiveStyles = css`
  color: ${baseTheme.colors.green[800]};
  background: ${baseTheme.colors.green[100]};
`

const progressTrackStyles = css`
  height: 3px;
  border-radius: 999px;
  background: ${baseTheme.colors.gray[200]};
  overflow: hidden;
`

const progressFillStyles = css`
  height: 100%;
  border-radius: 999px;
  background: ${baseTheme.colors.green[600]};
  transition: width 200ms ease;
`

const statusLineStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
`

const statusLineUrgentStyles = css`
  color: ${baseTheme.colors.crimson[600]};
  font-weight: 500;
`

export interface StageNavigationBarProps {
  stages: ReadonlyArray<CourseDesignerStage>
  activeStage: CourseDesignerStage
  stageLabel: (stage: CourseDesignerStage) => string
  timeRemainingShort: string | null
  tasksRemainingCount: number
  isUrgent: boolean
  onClick: () => void
}

/** Renders stage tabs with progress and compact status (days left, tasks remaining). */
export default function StageNavigationBar({
  stages,
  activeStage,
  stageLabel,
  timeRemainingShort,
  tasksRemainingCount,
  isUrgent,
  onClick,
}: StageNavigationBarProps) {
  const { t } = useTranslation()
  const activeIndex = stages.indexOf(activeStage)
  const progressPercent = stages.length > 0 ? ((activeIndex + 0.5) / stages.length) * 100 : 0

  return (
    <BreakFromCentered sidebar={false}>
      <div className={barWrapperStyles}>
        <button
          type="button"
          onClick={onClick}
          className={navCardStyles}
          aria-label={t("course-plans-overview-title")}
        >
          <div className={tabsRowStyles}>
            {stages.map((stage) => (
              <span
                key={stage}
                className={`${tabStyles} ${stage === activeStage ? tabActiveStyles : ""}`}
              >
                {stageLabel(stage)}
              </span>
            ))}
          </div>
          <div className={progressTrackStyles}>
            <div className={cx(progressFillStyles, css({ width: `${progressPercent}%` }))} />
          </div>
          <div className={cx(statusLineStyles, isUrgent && statusLineUrgentStyles)}>
            {timeRemainingShort}
            {tasksRemainingCount >= 0 && (
              <>
                {timeRemainingShort ? STATUS_SEPARATOR : ""}
                {t("course-plans-tasks-remaining", { count: tasksRemainingCount })}
              </>
            )}
          </div>
        </button>
      </div>
    </BreakFromCentered>
  )
}
