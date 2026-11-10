"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { getCourseDesignerPlanOptions } from "@/generated/api/@tanstack/react-query.generated"
import { Button } from "@/shared-module/components"

import { usePlanArchiveActions } from "../../../hooks/usePlanArchiveActions"

interface PlanArchiveButtonProps {
  planId: string
}

/** Archives the plan, or restores it when it is already archived, after the member confirms. */
export default function PlanArchiveButton({ planId }: PlanArchiveButtonProps) {
  const { t } = useTranslation()
  const planQuery = useQuery(getCourseDesignerPlanOptions({ path: { plan_id: planId } }))
  const { archive, restore, isPending } = usePlanArchiveActions(planId)

  const status = planQuery.data?.plan.status
  if (status === undefined) {
    return null
  }

  if (status === "Archived") {
    return (
      <Button variant="secondary" size="medium" onClick={() => void restore()} disabled={isPending}>
        {t("course-plans-restore-plan")}
      </Button>
    )
  }

  return (
    <Button variant="tertiary" size="medium" onClick={() => void archive()} disabled={isPending}>
      {t("course-plans-archive-plan")}
    </Button>
  )
}
