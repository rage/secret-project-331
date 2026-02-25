"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import { coursePlanScheduleRoute } from "../coursePlanRoutes"

import { CourseDesignerPlanSummary } from "@/services/backend/courseDesigner"

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

  return (
    <button
      type="button"
      className={cardStyles}
      onClick={() => router.push(coursePlanScheduleRoute(plan.id))}
    >
      <div className={headerStyles}>
        <strong>{plan.name ?? t("course-plans-untitled-plan")}</strong>
        <span>{plan.status}</span>
      </div>
      <div className={metaStyles}>
        <span>{t("course-plans-members-count", { count: plan.member_count })}</span>
        <span>{t("course-plans-scheduled-stages-count", { count: plan.stage_count })}</span>
        <span>
          {t("course-plans-active-stage-value", {
            stage: plan.active_stage ?? t("course-plans-none"),
          })}
        </span>
      </div>
    </button>
  )
}
