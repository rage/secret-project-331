"use client"

import { css, cx } from "@emotion/css"
import { useTabListState } from "@react-stately/tabs"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import { type Key, type ReactNode, useMemo, useRef } from "react"
import { useFocusRing, useHover, useTab, useTabList, useTabPanel } from "react-aria"
import { useTranslation } from "react-i18next"

import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"

import {
  type CourseDesignerPlanStageWithTasks,
  type CourseDesignerStage,
} from "@/services/backend/courseDesigner"
import { baseTheme } from "@/shared-module/common/styles"

const tabStripCardStyles = css`
  border-radius: 12px;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: white;
  padding: 0.5rem 0.75rem 0;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  margin-bottom: 0.85rem;
`

const tabListRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.1rem;
`

const tabButtonBaseStyles = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 1rem;
  border-radius: 8px 8px 0 0;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  font-weight: 500;
  color: ${baseTheme.colors.gray[600]};
  cursor: pointer;
  transition:
    background 120ms ease,
    color 120ms ease,
    box-shadow 120ms ease;

  &:hover {
    background: ${baseTheme.colors.gray[50]};
    color: ${baseTheme.colors.gray[800]};
  }
`

const tabButtonSelectedStyles = css`
  background: ${baseTheme.colors.green[25]};
  color: ${baseTheme.colors.green[800]};
  font-weight: 600;
  box-shadow: inset 0 -3px 0 ${baseTheme.colors.green[600]};
`

const tabButtonFocusRingStyles = css`
  outline: 2px solid ${baseTheme.colors.green[500]};
  outline-offset: -2px;
`

const tabButtonLabelStyles = css`
  white-space: nowrap;
`

const tabStatusDotStyles = css`
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${baseTheme.colors.green[500]};
  flex-shrink: 0;

  &::after {
    content: "";
    position: absolute;
    inset: -5px;
    border-radius: inherit;
    border: 1px solid rgba(34, 197, 94, 0.5);
    opacity: 0;
    transform: scale(0.9);
    animation: workspace-tab-pulse 2s ease-out infinite;
  }

  @keyframes workspace-tab-pulse {
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

const tabStripDividerStyles = css`
  margin-top: 0.15rem;
  border: none;
  border-top: 1px solid ${baseTheme.colors.gray[200]};
`

interface WorkspaceStageTabStripProps {
  stagesData: Array<CourseDesignerPlanStageWithTasks>
  activeStage: CourseDesignerStage | null
  selectedStage: CourseDesignerStage | null
  onSelectedStageChange: (stage: CourseDesignerStage) => void
  stageLabel: (stage: CourseDesignerStage) => string
  panelClassName?: string
  children: ReactNode
}

interface WorkspaceStageTabItem {
  key: CourseDesignerStage
  label: string
  isCompleted: boolean
  isCurrent: boolean
}

const COURSE_DESIGNER_STAGE_KEYS = new Set<string>(SCHEDULE_STAGE_ORDER)

/** ARIA-compliant stage tabs that default to the active stage while allowing browsing others. */
export default function WorkspaceStageTabStrip({
  stagesData,
  activeStage,
  selectedStage,
  onSelectedStageChange,
  stageLabel,
  panelClassName,
  children,
}: WorkspaceStageTabStripProps) {
  const { t } = useTranslation()
  const items = useMemo<WorkspaceStageTabItem[]>(() => {
    const availableStages = itemsForStages(stagesData)

    return SCHEDULE_STAGE_ORDER.flatMap((stage) => {
      if (!availableStages.has(stage)) {
        return []
      }

      const stageData = stagesData.find((candidate) => candidate.stage === stage)

      return [
        {
          key: stage,
          label: stageLabel(stage),
          isCompleted: stageData?.status === "Completed",
          isCurrent: activeStage === stage,
        } satisfies WorkspaceStageTabItem,
      ]
    })
  }, [stagesData, activeStage, stageLabel])

  const state = useTabListState({
    selectedKey: selectedStage ?? undefined,
    onSelectionChange: (key: Key) => {
      if (isCourseDesignerStage(key)) {
        onSelectedStageChange(key)
      }
    },
    items: selectedStage ? items : [],
  })

  const listRef = useRef<HTMLDivElement | null>(null)
  const { tabListProps } = useTabList(
    {
      "aria-label": t("course-plans-stage-tabs-aria-label"),
    },
    state,
    listRef,
  )
  const panelRef = useRef<HTMLDivElement | null>(null)
  const { tabPanelProps } = useTabPanel({}, selectedStage ? state : null, panelRef)

  return (
    <>
      {selectedStage ? (
        <div className={tabStripCardStyles}>
          <div {...tabListProps} ref={listRef} className={tabListRowStyles}>
            {items.map((item) => (
              <WorkspaceStageTab
                key={item.key}
                itemKey={item.key}
                state={state}
                label={item.label}
                isCurrent={item.isCurrent}
                isCompleted={item.isCompleted}
              />
            ))}
          </div>
          <hr className={tabStripDividerStyles} />
        </div>
      ) : null}
      <div {...tabPanelProps} ref={panelRef} className={panelClassName}>
        {children}
      </div>
    </>
  )
}

function itemsForStages(
  stagesData: Array<CourseDesignerPlanStageWithTasks>,
): Set<CourseDesignerStage> {
  return new Set(stagesData.map((s) => s.stage))
}

function isCourseDesignerStage(key: Key | null): key is CourseDesignerStage {
  return typeof key === "string" && COURSE_DESIGNER_STAGE_KEYS.has(key)
}

interface WorkspaceStageTabProps {
  itemKey: CourseDesignerStage
  state: ReturnType<typeof useTabListState>
  label: string
  isCurrent: boolean
  isCompleted: boolean
}

function WorkspaceStageTab({
  itemKey,
  state,
  label,
  isCurrent,
  isCompleted,
}: WorkspaceStageTabProps) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const { tabProps } = useTab({ key: itemKey }, state, ref)
  const { isFocusVisible, focusProps } = useFocusRing()
  const { hoverProps } = useHover({})
  const isSelected = state.selectedKey === itemKey

  return (
    <button
      {...tabProps}
      {...focusProps}
      {...hoverProps}
      ref={ref}
      type="button"
      className={cx(
        tabButtonBaseStyles,
        isSelected && tabButtonSelectedStyles,
        isFocusVisible && tabButtonFocusRingStyles,
      )}
    >
      {isCurrent && <span className={tabStatusDotStyles} aria-hidden />}
      {isCompleted && !isCurrent && <CheckCircle size={13} color={baseTheme.colors.gray[400]} />}
      <span className={tabButtonLabelStyles}>{label}</span>
    </button>
  )
}
