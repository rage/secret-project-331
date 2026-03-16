"use client"

import { css, cx } from "@emotion/css"
import { startOfMonth } from "date-fns"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"

import TimelineMonthBlock from "./TimelineMonthBlock"

import {
  getStageMonths,
  type StageMonth,
} from "@/app/manage/course-plans/[id]/schedule/scheduleMappers"
import {
  type CourseDesignerPlanStageWithTasks,
  type CourseDesignerStage,
} from "@/services/backend/courseDesigner"
import { baseTheme } from "@/shared-module/common/styles"

const timelineCardStyles = css`
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
  border-radius: 12px;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: white;
  padding: 0.85rem 1rem 0.9rem;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  overflow-x: auto;
`

const innerTimelineStyles = css`
  position: relative;
  min-height: 86px;
`

const stageRowStyles = css`
  display: flex;
  align-items: flex-start;
  gap: 16px;
`

const stageBandStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

const stagePillStyles = css`
  align-self: flex-start;
  border-radius: 999px;
  padding: 0.15rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  background: white;
  border: 1px solid ${baseTheme.colors.gray[300]};
  white-space: nowrap;
`

const stageAccentBarStyles = css`
  height: 2px;
  border-radius: 999px;
  background: ${baseTheme.colors.gray[200]};
`

const stageMonthsRowStyles = css`
  display: flex;
  align-items: stretch;
  gap: 4px;
`

const activeStageBandStyles = (accent: string) => css`
  background: ${accent}14;
  border-radius: 8px;
  padding: 0.35rem 0.5rem 0.45rem;
  margin: -0.15rem 0;
`

const todayIndicatorStyles = css`
  position: absolute;
  top: 32px;
  bottom: 6px;
  width: 20px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 5;
`

const todayLabelStyles = css`
  font-size: 0.68rem;
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 0.1rem;
  text-shadow:
    0 0 2px rgba(255, 255, 255, 0.9),
    0 0 6px rgba(255, 255, 255, 0.9);
`

const todayTriangleStyles = css`
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #ef4444;
`

const todayLineStyles = css`
  margin-top: 2px;
  flex: 1;
  width: 2px;
  border-radius: 999px;
  background: #ef4444;
`

const STAGE_ACCENTS: Record<CourseDesignerStage, string> = {
  Analysis: "#3B82F6",
  Design: "#8B5CF6",
  Development: "#F59E0B",
  Implementation: "#22C55E",
  Evaluation: "#14B8A6",
}

const BLOCK_WIDTH = 84
const BLOCK_GAP = 4
const STAGE_GROUP_GAP = 16

interface StageTimelineProps {
  stages: Array<CourseDesignerPlanStageWithTasks>
  stageLabel: (stage: CourseDesignerStage) => string
}

export default function StageTimeline({ stages, stageLabel }: StageTimelineProps) {
  const { t } = useTranslation()
  const { orderedStages, stageMonths, todayPositionPx } = useMemo(() => {
    const byStage = new Map<CourseDesignerStage, CourseDesignerPlanStageWithTasks>()
    stages.forEach((s) => {
      byStage.set(s.stage, s)
    })

    const ordered = SCHEDULE_STAGE_ORDER.map((stage) => byStage.get(stage)).filter(
      (s): s is CourseDesignerPlanStageWithTasks => Boolean(s),
    )

    const monthsByStage: StageMonth[][] = ordered.map((stage) =>
      getStageMonths({
        stage: stage.stage,
        planned_starts_on: stage.planned_starts_on,
        planned_ends_on: stage.planned_ends_on,
      }),
    )

    let todayPx: number | null = null
    const today = startOfMonth(new Date())

    let flatIndex = 0
    let foundToday = false

    monthsByStage.forEach((months, stageIndex) => {
      months.forEach((month) => {
        if (!foundToday && startOfMonth(month.date).getTime() === today.getTime()) {
          const baseFromPreviousStages =
            stageIndex * (STAGE_GROUP_GAP - BLOCK_GAP) + flatIndex * (BLOCK_WIDTH + BLOCK_GAP)
          todayPx = baseFromPreviousStages + BLOCK_WIDTH / 2
          foundToday = true
        }
        flatIndex += 1
      })
    })

    return {
      orderedStages: ordered,
      stageMonths: monthsByStage,
      todayPositionPx: todayPx,
    }
  }, [stages])

  if (orderedStages.length === 0) {
    return null
  }

  const minHeight = stageMonths.some((months) => months.length > 0) ? 96 : 0

  return (
    <div className={timelineCardStyles} aria-label={t("course-plans-timeline-aria-label")}>
      <div className={cx(innerTimelineStyles, css({ minHeight }))}>
        {todayPositionPx != null && (
          <div className={css(todayIndicatorStyles, { left: todayPositionPx })}>
            <span className={todayLabelStyles}>{t("course-plans-timeline-today-label")}</span>
            <div className={todayTriangleStyles} />
            <div className={todayLineStyles} />
          </div>
        )}
        <div className={stageRowStyles}>
          {orderedStages.map((stage, index) => {
            const months = stageMonths[index] ?? []
            const accent = STAGE_ACCENTS[stage.stage]
            const bandContent = (
              <>
                <span
                  className={css`
                    ${stagePillStyles}
                    border-color: ${accent};
                    color: ${accent};
                  `}
                >
                  {stageLabel(stage.stage)}
                </span>
                <div
                  className={css`
                    ${stageAccentBarStyles}
                    background: ${accent};
                  `}
                />
                <div className={stageMonthsRowStyles}>
                  {months.map((month) => (
                    <TimelineMonthBlock key={month.id} month={month} />
                  ))}
                </div>
              </>
            )

            const isActive = stage.status === "InProgress"

            return (
              <div
                key={stage.id}
                className={cx(
                  stageBandStyles,
                  isActive && activeStageBandStyles(accent),
                  css({ minHeight: 80 }),
                )}
              >
                {bandContent}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
