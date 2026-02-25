"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import { CourseDesignerPlanSummary } from "@/services/backend/courseDesigner"
import { manageCoursePlanRoute } from "@/shared-module/common/utils/routes"

const cardStyles = css`
  border: 1px solid #d9dde4;
  border-radius: 12px;
  padding: 1rem;
  background: white;
`

const headerStyles = css`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
  text-align: left;
  width: 100%;
`

const metaStyles = css`
  color: #5d6776;
  font-size: 0.95rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
`

interface CoursePlanCardProps {
  plan: CourseDesignerPlanSummary
}

export default function CoursePlanCard({ plan }: CoursePlanCardProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const statusLabel = (() => {
    switch (plan.status) {
      case "Draft":
        return t("course-plans-status-draft")
      case "Scheduling":
        return t("course-plans-status-scheduling")
      case "ReadyToStart":
        return t("course-plans-status-ready-to-start")
      case "InProgress":
        return t("course-plans-status-in-progress")
      case "Completed":
        return t("course-plans-status-completed")
      case "Archived":
        return t("course-plans-status-archived")
    }
  })()

  const activeStageLabel = (() => {
    switch (plan.active_stage) {
      case "Analysis":
        return t("course-plans-stage-analysis")
      case "Design":
        return t("course-plans-stage-design")
      case "Development":
        return t("course-plans-stage-development")
      case "Implementation":
        return t("course-plans-stage-implementation")
      case "Evaluation":
        return t("course-plans-stage-evaluation")
      case null:
      case undefined:
        return t("course-plans-none")
    }
  })()

  return (
    <button
      type="button"
      className={cardStyles}
      onClick={() => router.push(manageCoursePlanRoute(plan.id))}
    >
      <div className={headerStyles}>
        <strong>{plan.name ?? t("course-plans-untitled-plan")}</strong>
        <span>{statusLabel}</span>
      </div>
      <div className={metaStyles}>
        <span>{t("course-plans-members-count", { count: plan.member_count })}</span>
        <span>{t("course-plans-scheduled-stages-count", { count: plan.stage_count })}</span>
        <span>
          {t("course-plans-active-stage-value", {
            stage: activeStageLabel,
          })}
        </span>
      </div>
    </button>
  )
}
