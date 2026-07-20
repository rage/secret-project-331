"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type { CourseDesignerPlanSummary } from "@/generated/api/types.generated"

import CoursePlanCard from "./CoursePlanCard"

const listStyles = css`
  display: grid;
  gap: 1rem;
`

interface CoursePlanListProps {
  plans: CourseDesignerPlanSummary[]
}

export default function CoursePlanList({ plans }: CoursePlanListProps) {
  const { t } = useTranslation()

  return (
    <div className={listStyles}>
      {plans.length === 0 && <p>{t("course-plans-empty")}</p>}
      {plans.map((plan) => (
        <CoursePlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  )
}
