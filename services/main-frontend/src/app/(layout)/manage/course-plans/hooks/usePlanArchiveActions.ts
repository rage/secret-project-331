import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import {
  archiveCourseDesignerPlanMutation,
  getCourseDesignerPlansQueryKey,
  unarchiveCourseDesignerPlanMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { useDialog } from "@/shared-module/components"

import { useInvalidatePlan } from "./useInvalidatePlan"

/**
 * Archive and restore actions for one plan. Both ask for confirmation first and refresh the plan
 * and the plan list afterwards; each resolves once the request settles or the member cancels.
 */
export function usePlanArchiveActions(planId: string) {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  const invalidatePlan = useInvalidatePlan(planId)

  const refreshPlan = async () => {
    await invalidatePlan()
    await queryClient.invalidateQueries({ queryKey: getCourseDesignerPlansQueryKey() })
  }

  const archiveMutation = useToastMutationOptions(
    archiveCourseDesignerPlanMutation(),
    { notify: true, method: "POST" },
    { onSuccess: refreshPlan },
  )
  const restoreMutation = useToastMutationOptions(
    unarchiveCourseDesignerPlanMutation(),
    { notify: true, method: "POST" },
    { onSuccess: refreshPlan },
  )

  const archive = async () => {
    const isConfirmed = await confirm({
      title: t("course-plans-archive-confirm-title"),
      message: t("course-plans-archive-confirm-body"),
      confirmLabel: t("course-plans-archive-plan"),
    })
    if (isConfirmed) {
      await archiveMutation.mutateAsync({ path: { plan_id: planId } }).catch(() => undefined)
    }
  }

  const restore = async () => {
    const isConfirmed = await confirm({
      title: t("course-plans-restore-confirm-title"),
      message: t("course-plans-restore-confirm-body"),
      confirmLabel: t("course-plans-restore-plan"),
    })
    if (isConfirmed) {
      await restoreMutation.mutateAsync({ path: { plan_id: planId } }).catch(() => undefined)
    }
  }

  return {
    archive,
    restore,
    isPending: archiveMutation.isPending || restoreMutation.isPending,
  }
}
