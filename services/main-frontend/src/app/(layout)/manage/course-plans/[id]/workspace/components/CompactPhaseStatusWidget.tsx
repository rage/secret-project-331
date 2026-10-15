"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

const widgetCardStyles = css`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  background: white;
  border: 1px solid ${baseTheme.colors.gray[200]};
  box-shadow: none;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease;
  text-align: left;

  :hover {
    border-color: ${baseTheme.colors.gray[300]};
  }
`

const phaseNameStyles = css`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

const statusLineStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
`

const statusLineUrgentStyles = css`
  color: ${baseTheme.colors.crimson[600]};
`

const tasksLineStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
  margin: 0;
`

const viewPlanLinkStyles = css`
  font-size: 0.85rem;
  font-weight: 500;
  color: ${baseTheme.colors.green[700]};
  margin-top: 0.25rem;
  text-decoration: none;

  :hover {
    text-decoration: underline;
  }
`

export interface CompactPhaseStatusWidgetProps {
  phaseName: string
  statusTimeLine: string
  tasksRemainingCount: number
  isUrgent: boolean
  onClick: () => void
}

/** Compact status summary: phase name, status + time, tasks remaining, View plan link. */
export default function CompactPhaseStatusWidget({
  phaseName,
  statusTimeLine,
  tasksRemainingCount,
  isUrgent,
  onClick,
}: CompactPhaseStatusWidgetProps) {
  const { t } = useTranslation()

  const tasksText =
    tasksRemainingCount === 1
      ? t("course-plans-task-remaining", { count: 1 })
      : t("course-plans-tasks-remaining", { count: tasksRemainingCount })

  return (
    <button
      type="button"
      onClick={onClick}
      className={widgetCardStyles}
      aria-label={t("course-plans-view-plan")}
    >
      <span className={phaseNameStyles}>{phaseName}</span>
      <span className={`${statusLineStyles} ${isUrgent ? statusLineUrgentStyles : ""}`}>
        {statusTimeLine}
      </span>
      {tasksRemainingCount >= 0 && <span className={tasksLineStyles}>{tasksText}</span>}
      <span className={viewPlanLinkStyles}>{t("course-plans-view-plan")}</span>
    </button>
  )
}
