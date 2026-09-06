"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCreditRegistrationOverviewQueryKey,
  listCreditRegistrationPhasesQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminPausePhase, adminResumePhase, adminRunPhaseNow } from "@/generated/api/sdk.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Menu, type MenuItemDescriptor } from "@/shared-module/components"

import { usePauseResumeAction } from "./usePauseResumeAction"

interface Props {
  phase: string
  paused: boolean
  implemented: boolean
}

/** Pause, resume and run-now for one pipeline phase, collapsed into the System tab's row menu. */
const AdminPhaseActions: React.FC<Props> = ({ phase, paused, implemented }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()

  const invalidatePhases = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
      queryClient.invalidateQueries({ queryKey: listCreditRegistrationPhasesQueryKey() }),
    ])

  const { pauseItem, resumeItem, dialog } = usePauseResumeAction({
    pause: (fields) => adminPausePhase({ path: { phase }, body: { reason: fields.reason } }),
    resume: () => adminResumePhase({ path: { phase }, body: { reason: null } }),
    invalidate: () => void invalidatePhases(),
    resumeConfirmMessage: t("credit-registration-admin-phase-resume-confirm", { phase }),
    pauseActionLabel: t("button-text-credit-registration-phase-pause"),
    resumeActionLabel: t("button-text-credit-registration-phase-resume"),
    pauseDialogTitle: t("credit-registration-admin-phase-pause-title", { phase }),
    pauseReasonDescription: t("credit-registration-admin-phase-pause-reason-description"),
  })

  const runNowMutation = useToastMutation(
    () => adminRunPhaseNow({ path: { phase }, body: { reason: null } }),
    { notify: true, method: "POST" },
    { onSuccess: () => void invalidatePhases() },
  )

  if (!implemented) {
    return null
  }

  const runNowItem: MenuItemDescriptor = {
    // oxlint-disable-next-line i18next/no-literal-string -- menu item identity, not user-facing text
    key: "run-now",
    label: t("button-text-credit-registration-phase-run-now"),
    isDisabled: runNowMutation.isPending,
    onAction: async () => {
      const confirmed = await confirm(
        t("credit-registration-admin-phase-run-now-confirm", { phase }),
        undefined,
        { yesButtonLabel: t("button-text-credit-registration-phase-run-now") },
      )
      if (confirmed) {
        runNowMutation.mutate()
      }
    },
  }

  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-phase-row-actions", { phase })}
        items={paused ? [resumeItem] : [pauseItem, runNowItem]}
      />
      {dialog}
    </>
  )
}

export default AdminPhaseActions
