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
  /** Shown when `plans` is empty; defaults to the no-plans-yet message. */
  emptyTitle?: string | undefined
}

export default function CoursePlanList({ plans, emptyTitle }: CoursePlanListProps) {
  const { t } = useTranslation()

  if (plans.length === 0) {
    return <EmptyState title={emptyTitle ?? t("course-plans-empty")} />
  }

  return (
    <div className={listStyles}>
      {plans.map((plan) => (
        <CoursePlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  )
}
