import { css } from "@emotion/css"

import type { StageMonth } from "@/app/manage/course-plans/[id]/schedule/scheduleMappers"
import type { CourseDesignerStage } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

export const STAGE_ACCENTS: Record<CourseDesignerStage, string> = {
  Analysis: baseTheme.colors.green[600],
  Design: baseTheme.colors.green[600],
  Development: baseTheme.colors.green[600],
  Implementation: baseTheme.colors.green[600],
  Evaluation: baseTheme.colors.green[600],
}

/** Month key for timeline comparisons. */
export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export interface StageTimelineTabItem {
  key: CourseDesignerStage
  label: string
  isCompleted: boolean
  isCurrent: boolean
  months: StageMonth[]
}

export const tabBandBaseStyles = css`
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

export const tabBandUnselectedStyles = css`
  &:hover {
    background: ${baseTheme.colors.gray[75]};
    border-radius: 10px;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  }
`

export const tabBandSelectedStyles = (accent: string) => css`
  background: ${accent}20;
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.08),
    0 1px 3px rgba(15, 23, 42, 0.05);
  border-bottom: 3px solid ${accent};
  border-radius: 8px 8px 0 0;
`

export const tabBandFocusRingStyles = css`
  outline: 2px solid ${baseTheme.colors.green[500]};
  outline-offset: 2px;
`

export const tabBandDividerStyles = css`
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

export const stagePillStyles = css`
  display: inline-flex;
  align-items: center;
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
  line-height: 1;
`

export const stagePillSelectedStyles = (accent: string) => css`
  background: ${accent};
  border-color: ${accent};
  color: white;
  box-shadow:
    0 1px 4px rgba(15, 23, 42, 0.15),
    0 0 0 1px ${accent}33;
`

export const stagePillCompletedStyles = css`
  background: ${baseTheme.colors.gray[50]};
  border-color: ${baseTheme.colors.gray[200]};
  color: ${baseTheme.colors.gray[500]};
`

export const stagePillFutureStyles = (accent: string) => css`
  border-color: ${accent}80;
  color: ${accent}b3;
`

export const stageMonthsRowStyles = css`
  display: flex;
  align-items: stretch;
  gap: 6px;
`

export const monthDimmedStyles = css`
  opacity: 0.75;
`

export const activeStageDotStyles = css`
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

export const completedStageCheckStyles = css`
  display: inline-block;
  width: 9px;
  height: 9px;
  border-bottom: 2px solid currentColor;
  border-left: 2px solid currentColor;
  transform: translateY(-1px) rotate(-45deg);
  transform-origin: center;
`
