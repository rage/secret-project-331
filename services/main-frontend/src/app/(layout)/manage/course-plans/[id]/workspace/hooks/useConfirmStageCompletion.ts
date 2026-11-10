import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { CourseDesignerStage } from "@/generated/api/types.generated"
import { useDialog } from "@/shared-module/components"

import { daysUntilPlanDate, formatPlanDate } from "../../../coursePlanDates"

interface CompletableStage {
  stage: CourseDesignerStage
  planned_ends_on: string
}

/**
 * Asks the member to confirm completing the active stage, explaining that finishing before the
 * planned end keeps the planned dates. Resolves `true` when confirmed.
 */
export function useConfirmStageCompletion() {
  const { t, i18n } = useTranslation()
  const { confirm } = useDialog()

  return useCallback(
    (
      stage: CompletableStage,
      stageLabel: (stage: CourseDesignerStage) => string,
      nextStageLabel: string | null,
    ): Promise<boolean> => {
      const name = stageLabel(stage.stage)
      const sentences = [
        nextStageLabel
          ? t("course-plans-complete-stage-confirm-body", {
              stage: name,
              nextStage: nextStageLabel,
            })
          : t("course-plans-complete-stage-confirm-body-final", { stage: name }),
      ]
      if (nextStageLabel && daysUntilPlanDate(stage.planned_ends_on) >= 0) {
        sentences.push(
          t("course-plans-complete-stage-confirm-early", {
            date: formatPlanDate(stage.planned_ends_on, i18n.language),
          }),
        )
      }
      return confirm({
        title: t("course-plans-complete-stage-confirm-title", { stage: name }),
        message: sentences.join(" "),
        confirmLabel: t("course-plans-complete-stage-confirm-button"),
      })
    },
    [confirm, i18n.language, t],
  )
}
