"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { getCourseDesignerPlanOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseDesignerStage } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"

import { daysUntilPlanDate, formatPlanDate } from "../../../coursePlanDates"
import AdjustScheduleDialog from "../../schedule/components/AdjustScheduleDialog"
import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"
import { useConfirmStageCompletion } from "../hooks/useConfirmStageCompletion"

const cardStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid ${baseTheme.colors.gray[100]};
  border-radius: 10px;
  background: ${baseTheme.colors.gray[50]};
`

const overdueCardStyles = css`
  border-color: ${baseTheme.colors.crimson[200]};
  background: ${baseTheme.colors.crimson[50]};
`

const textStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;

  p {
    margin: 0;
  }
`

const deadlineStyles = css`
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
`

const questionStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
`

const actionsStyles = css`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`

export interface ActiveStageDeadlineCardProps {
  planId: string
  stageLabel: (stage: CourseDesignerStage) => string
  /** Completes the active stage and starts the next one; the card confirms with the member first. */
  onCompleteStage: () => void
  isCompletePending: boolean
  /** Extends the active stage by whole months (1–24). */
  onExtendActiveStage: (months: number) => void
  isExtendPending: boolean
}

/**
 * Shows when the active stage is planned to end and asks whether it is done, with buttons to
 * complete the stage or adjust the schedule. Renders nothing unless the plan is in progress.
 */
export default function ActiveStageDeadlineCard({
  planId,
  stageLabel,
  onCompleteStage,
  isCompletePending,
  onExtendActiveStage,
  isExtendPending,
}: ActiveStageDeadlineCardProps) {
  const { t, i18n } = useTranslation()
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)
  const confirmStageCompletion = useConfirmStageCompletion()
  const planQuery = useQuery(getCourseDesignerPlanOptions({ path: { plan_id: planId } }))

  const plan = planQuery.data?.plan
  const stages = planQuery.data?.stages ?? []
  const activeStage = plan?.status === "InProgress" ? (plan.active_stage ?? null) : null
  const activeStageData = stages.find((stage) => stage.stage === activeStage) ?? null
  if (activeStage === null || activeStageData === null) {
    return null
  }

  const activeIndex = SCHEDULE_STAGE_ORDER.indexOf(activeStage)
  const nextStage = SCHEDULE_STAGE_ORDER[activeIndex + 1] ?? null
  const nextStageLabel = nextStage ? stageLabel(nextStage) : null
  const name = stageLabel(activeStage)
  const endsOn = formatPlanDate(activeStageData.planned_ends_on, i18n.language)
  const daysLeft = daysUntilPlanDate(activeStageData.planned_ends_on)
  const isOverdue = daysLeft < 0

  const handleDone = async () => {
    if (await confirmStageCompletion(activeStageData, stageLabel, nextStageLabel)) {
      onCompleteStage()
    }
  }

  return (
    <section
      className={cx(cardStyles, isOverdue && overdueCardStyles)}
      aria-label={t("course-plans-deadline-card-label")}
    >
      <div className={textStyles}>
        <p className={deadlineStyles}>
          {t("course-plans-deadline-ends-on", { stage: name, date: endsOn })}{" "}
          {isOverdue
            ? t("course-plans-deadline-days-overdue", { count: -daysLeft })
            : t("course-plans-deadline-days-left", { count: daysLeft })}
        </p>
        <p className={questionStyles}>{t("course-plans-deadline-question", { stage: name })}</p>
      </div>
      <div className={actionsStyles}>
        <Button
          variant="secondary"
          size="medium"
          onClick={() => setIsAdjustDialogOpen(true)}
          disabled={isCompletePending || isExtendPending}
        >
          {t("course-plans-overview-adjust-schedule")}
        </Button>
        <Button
          variant="primary"
          size="medium"
          onClick={() => void handleDone()}
          disabled={isCompletePending}
        >
          {t("course-plans-deadline-done")}
        </Button>
      </div>
      <AdjustScheduleDialog
        open={isAdjustDialogOpen}
        onClose={() => setIsAdjustDialogOpen(false)}
        planId={planId}
        stages={stages}
        activeStage={activeStage}
        stageLabel={stageLabel}
        onExtendActiveStage={onExtendActiveStage}
        isExtendPending={isExtendPending}
      />
    </section>
  )
}
