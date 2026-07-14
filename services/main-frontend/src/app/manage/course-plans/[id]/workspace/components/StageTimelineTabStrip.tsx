"use client"

import { css, cx } from "@emotion/css"
import { useTabListState } from "@react-stately/tabs"
import { type Key, type ReactNode, useMemo, useRef } from "react"
import { useTabList, useTabPanel } from "react-aria"
import { useTranslation } from "react-i18next"

import { getStageMonths } from "@/app/manage/course-plans/[id]/schedule/scheduleMappers"
import type {
  CourseDesignerPlanStageWithTasks,
  CourseDesignerStage,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"
import { useStageTimelineMeasurements } from "../hooks/useStageTimelineMeasurements"
import type { StageTimelineTabItem } from "./stageTimelineShared"
import StageTimelineTab from "./StageTimelineTab"

const timelineShellStyles = css`
  position: relative;
  margin-top: 0.5rem;
  padding-top: 2.3rem;
  overflow-x: auto;
`

const cardStyles = css`
  margin: 0;
  border-radius: 12px;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-top: 2px solid ${baseTheme.colors.green[200]};
  background: ${baseTheme.colors.primary[100]};
  padding: 0.7rem 0.9rem 0.2rem;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
`

const tabListRowStyles = css`
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 20px;
  min-height: 84px;
  padding: 0 0.15rem 0.65rem;
`

const currentStageCalloutContainerStyles = css`
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0.9rem;
  border-radius: 8px;
  background: ${baseTheme.colors.green[50]};
  border: 1px solid ${baseTheme.colors.green[200]};
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  z-index: 6;
  justify-content: center;
  border-bottom: 2px solid ${baseTheme.colors.green[200]};
  max-width: calc(100% - 0.5rem);
`

const currentStageLabelStyles = css`
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
`

const currentStageEditButtonStyles = css`
  background: transparent;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  color: ${baseTheme.colors.gray[700]};
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${baseTheme.colors.gray[100]};
    color: ${baseTheme.colors.gray[800]};
    text-decoration: underline;
    outline: none;
  }
`

const todayIndicatorStyles = css`
  position: absolute;
  top: -10px;
  bottom: 56px;
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
  color: ${baseTheme.colors.red[600]};
  margin-bottom: 0.1rem;
  text-shadow:
    0 0 2px ${baseTheme.colors.primary[100]},
    0 0 6px ${baseTheme.colors.primary[100]};
`

const todayTriangleStyles = css`
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 6px solid ${baseTheme.colors.red[600]};
`

const todayLineStyles = css`
  margin-top: 2px;
  flex: 1;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(
    to bottom,
    ${baseTheme.colors.red[600]},
    ${baseTheme.colors.red[600]}40
  );
`

interface StageTimelineTabStripProps {
  stages: CourseDesignerPlanStageWithTasks[]
  activeStage: CourseDesignerStage | null
  selectedStage: CourseDesignerStage | null
  onSelectedStageChange: (stage: CourseDesignerStage) => void
  stageLabel: (stage: CourseDesignerStage) => string
  onOpenOverview?: () => void
  currentStageLabel?: string | null
  panelClassName?: string
  children: ReactNode
}

/** Unified timeline and tab strip for course plan stages. */
export default function StageTimelineTabStrip({
  stages,
  activeStage,
  selectedStage,
  onSelectedStageChange,
  stageLabel,
  onOpenOverview,
  currentStageLabel,
  panelClassName,
  children,
}: StageTimelineTabStripProps) {
  const { t } = useTranslation()

  const { orderedStages, items } = useMemo(() => {
    const byStage = new Map<CourseDesignerStage, CourseDesignerPlanStageWithTasks>()
    stages.forEach((stage) => {
      byStage.set(stage.stage, stage)
    })

    const ordered = SCHEDULE_STAGE_ORDER.map((stage) => byStage.get(stage)).filter(
      (stage): stage is CourseDesignerPlanStageWithTasks => Boolean(stage),
    )

    const builtItems: StageTimelineTabItem[] = ordered.map((stage) => ({
      key: stage.stage,
      label: stageLabel(stage.stage),
      isCompleted: stage.status === "Completed",
      isCurrent: stage.status === "InProgress",
      months: getStageMonths({
        stage: stage.stage,
        planned_starts_on: stage.planned_starts_on,
        planned_ends_on: stage.planned_ends_on,
      }),
    }))

    return { orderedStages: ordered, items: builtItems }
  }, [stages, stageLabel])

  const { todayPositionPx, currentStagePosition, listRef, shellRef, currentStageCalloutRef } =
    useStageTimelineMeasurements({
      activeStage,
      selectedStage,
      stagesDependency: stages,
      ...(currentStageLabel !== undefined ? { currentStageLabel } : {}),
    })

  const firstItemKey = items[0]?.key
  const state = useTabListState({
    ...(selectedStage !== null ? { selectedKey: selectedStage } : {}),
    ...(firstItemKey !== undefined ? { defaultSelectedKey: firstItemKey } : {}),
    items: items.map((item) => ({
      key: item.key,
      id: item.key,
      textValue: item.label,
    })),
    onSelectionChange: (key: Key) => {
      if (typeof key === "string") {
        onSelectedStageChange(key as CourseDesignerStage)
      }
    },
  })

  const { tabListProps } = useTabList(
    {
      "aria-label": t("course-plans-stage-tabs-aria-label"),
    },
    state,
    listRef,
  )

  const panelRef = useRef<HTMLDivElement | null>(null)
  const { tabPanelProps } = useTabPanel({}, state, panelRef)

  if (orderedStages.length === 0) {
    return (
      <div {...tabPanelProps} ref={panelRef} className={panelClassName}>
        {children}
      </div>
    )
  }

  return (
    <>
      <div className={timelineShellStyles} ref={shellRef}>
        {activeStage && currentStagePosition !== null && onOpenOverview && (
          <div
            ref={currentStageCalloutRef}
            className={cx(
              currentStageCalloutContainerStyles,
              css({
                left: currentStagePosition.left,
                top: 0,
                minWidth: currentStagePosition.minWidth,
              }),
            )}
          >
            <span className={currentStageLabelStyles}>{t("course-plans-current-stage-label")}</span>
            <button
              type="button"
              className={currentStageEditButtonStyles}
              onClick={onOpenOverview}
              aria-label={t("course-plans-current-stage-edit-aria", {
                stage: currentStageLabel ?? "",
              })}
            >
              {t("course-plans-current-stage-edit-label")}
            </button>
          </div>
        )}
        <div className={cardStyles}>
          <div {...tabListProps} ref={listRef} className={tabListRowStyles}>
            {todayPositionPx !== null && (
              <div className={cx(todayIndicatorStyles, css({ left: todayPositionPx }))}>
                <span className={todayLabelStyles}>{t("course-plans-timeline-today-label")}</span>
                <div className={todayTriangleStyles} />
                <div className={todayLineStyles} />
              </div>
            )}
            {items.map((item) => (
              <StageTimelineTab
                key={item.key}
                item={item}
                state={state}
                activeStage={activeStage}
                onSelectedStageChange={onSelectedStageChange}
              />
            ))}
          </div>
        </div>
      </div>
      <div {...tabPanelProps} ref={panelRef} className={panelClassName}>
        {children}
      </div>
    </>
  )
}
