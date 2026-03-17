"use client"

import { css, cx } from "@emotion/css"
import { useTabListState } from "@react-stately/tabs"
import { type Key, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react"
import { useFocusRing, useHover, useTab, useTabList, useTabPanel } from "react-aria"
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

const timelineShellStyles = css`
  position: relative;
  margin-top: 0.75rem;
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

const tabBandBaseStyles = css`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 80px;
  padding: 0.35rem 0.5rem 0.45rem;
  border-radius: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background 140ms ease,
    box-shadow 140ms ease,
    transform 120ms ease;
  text-align: left;
`

const tabBandUnselectedStyles = css`
  &:hover {
    background: ${baseTheme.colors.gray[75]};
    border-radius: 10px;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  }
`

const tabBandSelectedStyles = (accent: string) => css`
  background: ${accent}20;
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.08),
    0 1px 3px rgba(15, 23, 42, 0.05);
  border-bottom: 3px solid ${accent};
  border-radius: 8px 8px 0 0;
`

const tabBandFocusRingStyles = css`
  outline: 2px solid ${baseTheme.colors.green[500]};
  outline-offset: 2px;
`

const stagePillStyles = css`
  align-self: flex-start;
  border-radius: 999px;
  padding: 0.2rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  background: ${baseTheme.colors.gray[100]};
  border: 1px solid ${baseTheme.colors.gray[300]};
  white-space: nowrap;
`

const stagePillSelectedStyles = (accent: string) => css`
  background: ${accent};
  border-color: ${accent};
  color: white;
  box-shadow:
    0 1px 4px rgba(15, 23, 42, 0.15),
    0 0 0 1px ${accent}33;
`

const stagePillCompletedStyles = css`
  background: ${baseTheme.colors.gray[50]};
  border-color: ${baseTheme.colors.gray[200]};
  color: ${baseTheme.colors.gray[500]};
`

const stagePillFutureStyles = (accent: string) => css`
  border-color: ${accent}80;
  color: ${accent}b3;
`

const stageMonthsRowStyles = css`
  display: flex;
  align-items: stretch;
  gap: 6px;
`

const monthDimmedStyles = css`
  opacity: 0.75;
`

const activeStageDotStyles = css`
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${baseTheme.colors.green[500]};
  flex-shrink: 0;
  margin-right: 0.3rem;

  &::after {
    content: "";
    position: absolute;
    inset: -5px;
    border-radius: inherit;
    border: 1px solid rgba(34, 197, 94, 0.5);
    opacity: 0;
    transform: scale(0.9);
    animation: workspace-timeline-tab-pulse 2s ease-out infinite;
  }

  @keyframes workspace-timeline-tab-pulse {
    0% {
      opacity: 0.5;
      transform: scale(0.9);
    }
    70% {
      opacity: 0;
      transform: scale(1.4);
    }
    100% {
      opacity: 0;
      transform: scale(1.4);
    }
  }
`

const completedStageCheckStyles = css`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-bottom: 2px solid ${baseTheme.colors.gray[500]};
  border-left: 2px solid ${baseTheme.colors.gray[500]};
  transform: rotate(-45deg);
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
  transform: translateX(-50%);
  justify-content: center;
  border-bottom: 2px solid ${baseTheme.colors.green[200]};
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

const tabBandDividerStyles = css`
  position: relative;

  &:not(:first-of-type)::before {
    content: "";
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: -8px;
    width: 1px;
    background: ${baseTheme.colors.gray[200]};
  }
`

const STAGE_ACCENTS: Record<CourseDesignerStage, string> = {
  Analysis: baseTheme.colors.green[600],
  Design: baseTheme.colors.green[600],
  Development: baseTheme.colors.green[600],
  Implementation: baseTheme.colors.green[600],
  Evaluation: baseTheme.colors.green[600],
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

interface StageTimelineTabStripProps {
  stages: Array<CourseDesignerPlanStageWithTasks>
  activeStage: CourseDesignerStage | null
  selectedStage: CourseDesignerStage | null
  onSelectedStageChange: (stage: CourseDesignerStage) => void
  stageLabel: (stage: CourseDesignerStage) => string
  onOpenOverview?: () => void
  currentStageLabel?: string | null
  panelClassName?: string
  children: ReactNode
}

interface StageTimelineTabItem {
  key: CourseDesignerStage
  label: string
  isCompleted: boolean
  isCurrent: boolean
  months: StageMonth[]
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

  const [todayPositionPx, setTodayPositionPx] = useState<number | null>(null)
  const [currentStagePosition, setCurrentStagePosition] = useState<{
    centerX: number
    width: number
  } | null>(null)

  const state = useTabListState({
    selectedKey: selectedStage ?? undefined,
    defaultSelectedKey: items[0]?.key,
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

  const listRef = useRef<HTMLDivElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const { tabListProps } = useTabList(
    {
      "aria-label": t("course-plans-stage-tabs-aria-label"),
    },
    state,
    listRef,
  )

  const panelRef = useRef<HTMLDivElement | null>(null)
  const { tabPanelProps } = useTabPanel({}, state, panelRef)

  useEffect(() => {
    const updateTodayPosition = () => {
      const listElement = listRef.current
      if (!listElement) {
        setTodayPositionPx(null)
        return
      }
      const todayMonthElement = listElement.querySelector<HTMLElement>('[data-today-month="true"]')
      if (!todayMonthElement) {
        setTodayPositionPx(null)
        return
      }
      const listRect = listElement.getBoundingClientRect()
      const monthRect = todayMonthElement.getBoundingClientRect()
      const centerX = monthRect.left + monthRect.width / 2 - listRect.left
      setTodayPositionPx(centerX)
    }

    updateTodayPosition()
    if (typeof window === "undefined") {
      return
    }
    window.addEventListener("resize", updateTodayPosition)
    return () => {
      window.removeEventListener("resize", updateTodayPosition)
    }
  }, [stages])

  useEffect(() => {
    const updateCurrentStagePosition = () => {
      if (!activeStage) {
        setCurrentStagePosition(null)
        return
      }

      const shellElement = shellRef.current
      const listElement = listRef.current
      if (!shellElement || !listElement) {
        setCurrentStagePosition(null)
        return
      }

      const activeTabElement = listElement.querySelector<HTMLElement>(
        `[data-stage-key="${activeStage}"]`,
      )
      if (!activeTabElement) {
        setCurrentStagePosition(null)
        return
      }

      const shellRect = shellElement.getBoundingClientRect()
      const tabRect = activeTabElement.getBoundingClientRect()
      const centerX = tabRect.left + tabRect.width / 2 - shellRect.left
      setCurrentStagePosition({
        centerX,
        width: tabRect.width,
      })
    }

    updateCurrentStagePosition()
    if (typeof window === "undefined") {
      return
    }
    window.addEventListener("resize", updateCurrentStagePosition)

    const shellElement = shellRef.current
    shellElement?.addEventListener("scroll", updateCurrentStagePosition)

    return () => {
      window.removeEventListener("resize", updateCurrentStagePosition)
      shellElement?.removeEventListener("scroll", updateCurrentStagePosition)
    }
  }, [activeStage, stages])

  useEffect(() => {
    if (!selectedStage || !listRef.current) {
      return
    }
    const tabElement = listRef.current.querySelector<HTMLElement>(
      `[data-stage-key="${selectedStage}"]`,
    )
    if (tabElement) {
      // eslint-disable-next-line i18next/no-literal-string
      tabElement.scrollIntoView({ block: "nearest", inline: "center" })
    }
  }, [selectedStage])

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
        {activeStage && currentStagePosition != null && onOpenOverview && (
          <div
            className={cx(
              currentStageCalloutContainerStyles,
              css({
                left: currentStagePosition.centerX,
                top: 0,
                minWidth: Math.min(currentStagePosition.width + 32, 360),
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
            {todayPositionPx != null && (
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

interface StageTimelineTabProps {
  item: StageTimelineTabItem
  state: ReturnType<typeof useTabListState>
  activeStage: CourseDesignerStage | null
}

function StageTimelineTab({
  item,
  state,
  activeStage,
  onSelectedStageChange,
}: StageTimelineTabProps & {
  onSelectedStageChange: (stage: CourseDesignerStage) => void
}) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const labelId = useId()
  const { tabProps } = useTab({ key: item.key }, state, ref)
  const { isFocusVisible, focusProps } = useFocusRing()
  const { hoverProps } = useHover({})
  const isSelected = state.selectedKey === item.key
  const isActive = activeStage === item.key
  const accent = STAGE_ACCENTS[item.key]
  const isCompleted = item.isCompleted
  const isCurrent = item.isCurrent && !item.isCompleted

  const todayMonthKey = getMonthKey(new Date())

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    tabProps.onClick?.(event)
    if (!event.defaultPrevented) {
      onSelectedStageChange(item.key)
    }
  }

  return (
    <button
      {...tabProps}
      {...focusProps}
      {...hoverProps}
      ref={ref}
      type="button"
      aria-labelledby={labelId}
      onClick={handleClick}
      data-stage-key={item.key}
      className={cx(
        tabBandBaseStyles,
        tabBandDividerStyles,
        !isSelected && tabBandUnselectedStyles,
        isSelected && tabBandSelectedStyles(accent),
        isFocusVisible && tabBandFocusRingStyles,
      )}
    >
      <div className={stageMonthsRowStyles}>
        {item.months.map((month) => {
          const monthKey = getMonthKey(month.date)
          const isTodayMonth = monthKey === todayMonthKey

          return (
            <div
              key={month.id}
              data-today-month={isTodayMonth ? "true" : undefined}
              className={cx(!isSelected && monthDimmedStyles)}
            >
              <TimelineMonthBlock month={month} />
            </div>
          )
        })}
      </div>
      <div
        className={css`
          display: inline-flex;
          align-items: center;
          margin-top: 0.35rem;
        `}
      >
        {isActive && <span className={activeStageDotStyles} aria-hidden />}
        <span
          id={labelId}
          className={cx(
            stagePillStyles,
            css`
              border-color: ${accent};
              color: ${accent};
            `,
            isCompleted && stagePillCompletedStyles,
            !isSelected && !isCompleted && !isCurrent && stagePillFutureStyles(accent),
            isSelected && stagePillSelectedStyles(accent),
          )}
        >
          {isCompleted && (
            <span
              className={css`
                margin-right: 0.4rem;
              `}
              aria-hidden
            >
              <span className={completedStageCheckStyles} />
            </span>
          )}
          {item.label}
        </span>
      </div>
    </button>
  )
}
