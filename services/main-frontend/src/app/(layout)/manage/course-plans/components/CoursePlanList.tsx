"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type { CourseDesignerPlanSummary } from "@/generated/api/types.generated"
import { EmptyState } from "@/shared-module/components"

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

  if (plans.length === 0) {
    return <EmptyState title={t("course-plans-empty")} />
  }

  return (
    <div className={listStyles}>
      {plans.map((plan) => (
        <CoursePlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  )
}
