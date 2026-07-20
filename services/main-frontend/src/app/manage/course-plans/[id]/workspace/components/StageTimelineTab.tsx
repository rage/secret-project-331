"use client"

import { css, cx } from "@emotion/css"
import type { useTabListState } from "@react-stately/tabs"
import { useId, useRef } from "react"
import { useFocusRing, useHover, useTab } from "react-aria"

import type { CourseDesignerStage } from "@/generated/api/types.generated"

import {
  activeStageDotStyles,
  completedStageCheckStyles,
  getMonthKey,
  monthDimmedStyles,
  STAGE_ACCENTS,
  stageMonthsRowStyles,
  stagePillCompletedStyles,
  stagePillFutureStyles,
  stagePillSelectedStyles,
  stagePillStyles,
  type StageTimelineTabItem,
  tabBandBaseStyles,
  tabBandDividerStyles,
  tabBandFocusRingStyles,
  tabBandSelectedStyles,
  tabBandUnselectedStyles,
} from "./stageTimelineShared"
import TimelineMonthBlock from "./TimelineMonthBlock"

interface StageTimelineTabProps {
  item: StageTimelineTabItem
  state: ReturnType<typeof useTabListState>
  activeStage: CourseDesignerStage | null
  onSelectedStageChange: (stage: CourseDesignerStage) => void
}

/** Single stage tab in the workspace timeline strip. */
export default function StageTimelineTab({
  item,
  state,
  activeStage,
  onSelectedStageChange,
}: StageTimelineTabProps) {
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
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-right: 0.4rem;
                width: 12px;
                height: 12px;
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
