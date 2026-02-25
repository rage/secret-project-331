"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { coursePlanQueryKeys } from "../../../coursePlanQueryKeys"
import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"

import WorkspaceStageSection from "./WorkspaceStageSection"

import {
  advanceCourseDesignerStage,
  type CourseDesignerPlanStageWithTasks,
  type CourseDesignerStage,
  extendCourseDesignerStage,
  getCourseDesignerPlan,
  startCourseDesignerPlan,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"

const containerStyles = css`
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
`

const titleStyles = css`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${baseTheme.colors.gray[800]};
  margin: 0 0 0.5rem 0;
`

const cardStyles = css`
  background: white;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
`

const timeRemainingStyles = css`
  font-size: 1rem;
  color: ${baseTheme.colors.gray[600]};
  margin-bottom: 1rem;
`

const actionsRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
`

const instructionsPlaceholderStyles = css`
  color: ${baseTheme.colors.gray[500]};
  font-style: italic;
  padding: 1rem 0;
`

function daysBetween(from: string, to: string): number {
  const a = new Date(from)
  const b = new Date(to)
  const diff = b.getTime() - a.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function CoursePlanWorkspacePage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const planId = params.id ?? ""
  const queryClient = useQueryClient()

  const planQuery = useQuery({
    queryKey: coursePlanQueryKeys.detail(planId),
    queryFn: () => getCourseDesignerPlan(planId),
    enabled: !!planId,
  })

  const startMutation = useToastMutation(
    () => startCourseDesignerPlan(planId),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      },
    },
  )

  const extendMutation = useToastMutation(
    (stage: CourseDesignerStage) => extendCourseDesignerStage(planId, stage, 1),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      },
    },
  )

  const advanceMutation = useToastMutation(
    () => advanceCourseDesignerStage(planId),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      },
    },
  )

  const stageLabel = useCallback(
    (stage: CourseDesignerStage) => {
      // eslint-disable-next-line i18next/no-literal-string
      const key = `course-plans-stage-${stage.toLowerCase()}`
      return t(
        key as
          | "course-plans-stage-analysis"
          | "course-plans-stage-design"
          | "course-plans-stage-development"
          | "course-plans-stage-implementation"
          | "course-plans-stage-evaluation",
      )
    },
    [t],
  )

  if (planQuery.isError) {
    return (
      <div className={containerStyles}>
        <ErrorBanner variant="readOnly" error={planQuery.error} />
      </div>
    )
  }

  if (planQuery.isLoading || !planQuery.data) {
    return (
      <div className={containerStyles}>
        <Spinner variant="medium" />
      </div>
    )
  }

  const { plan, stages } = planQuery.data

  if (plan.status === "ReadyToStart" && !plan.active_stage) {
    return (
      <div className={containerStyles}>
        <h1 className={titleStyles}>{plan.name ?? t("course-plans-untitled-plan")}</h1>
        <div className={cardStyles}>
          <p>{t("course-plans-status-ready-to-start")}</p>
          <Button
            variant="primary"
            size="medium"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            {t("course-plans-start-plan")}
          </Button>
        </div>
      </div>
    )
  }

  const currentStage = plan.active_stage
  const currentStageData = currentStage ? stages.find((s) => s.stage === currentStage) : null

  const today = new Date().toISOString().slice(0, 10)
  let timeRemainingText: string | null = null
  if (currentStageData) {
    const days = daysBetween(today, currentStageData.planned_ends_on)
    if (days > 0) {
      timeRemainingText = t("course-plans-time-remaining-days", {
        count: days,
        stage: stageLabel(currentStageData.stage),
      })
    } else if (days < 0) {
      timeRemainingText = t("course-plans-time-remaining-overdue", {
        count: -days,
        stage: stageLabel(currentStageData.stage),
      })
    }
  }

  const canAct =
    plan.status === "InProgress" &&
    currentStage &&
    currentStageData &&
    currentStageData.status !== "Completed"

  // eslint-disable-next-line i18next/no-literal-string
  const timeRemainingSuffix = timeRemainingText != null ? ` · ${timeRemainingText}` : null

  return (
    <div className={containerStyles}>
      <h1 className={titleStyles}>{plan.name ?? t("course-plans-untitled-plan")}</h1>

      {currentStage && (
        <p className={timeRemainingStyles}>
          {t("course-plans-active-stage-value", {
            stage: stageLabel(currentStage),
          })}
          {timeRemainingSuffix}
        </p>
      )}

      {canAct && (
        <div className={actionsRowStyles}>
          <Button
            variant="secondary"
            size="medium"
            onClick={() => extendMutation.mutate(currentStage!)}
            disabled={extendMutation.isPending}
          >
            {t("course-plans-add-one-month-to-phase")}
          </Button>
          <Button
            variant="secondary"
            size="medium"
            onClick={() => advanceMutation.mutate()}
            disabled={advanceMutation.isPending}
          >
            {t("course-plans-start-next-phase-early")}
          </Button>
          <Button
            variant="primary"
            size="medium"
            onClick={() => advanceMutation.mutate()}
            disabled={advanceMutation.isPending}
          >
            {t("course-plans-mark-phase-done-proceed")}
          </Button>
        </div>
      )}

      <div className={cardStyles}>
        <p className={instructionsPlaceholderStyles}>
          {t("course-plans-instructions-placeholder")}
        </p>
      </div>

      {SCHEDULE_STAGE_ORDER.map((stageEnum) => {
        const stageData = stages.find((s) => s.stage === stageEnum) as
          | CourseDesignerPlanStageWithTasks
          | undefined
        if (!stageData) {
          return null
        }
        const isActive = plan.active_stage === stageEnum
        return (
          <WorkspaceStageSection
            key={stageData.id}
            planId={planId}
            stage={stageData}
            stageLabel={stageLabel(stageData.stage)}
            isActive={isActive}
            onInvalidate={() =>
              void queryClient.invalidateQueries({
                queryKey: coursePlanQueryKeys.detail(planId),
              })
            }
          />
        )
      })}
    </div>
  )
}
