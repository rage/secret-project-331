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
import { Button } from "@/shared-module/components"

import { pauseResumeRootCss, usePauseResumeAction } from "./usePauseResumeAction"

interface Props {
  phase: string
  paused: boolean
  implemented: boolean
}

/** Pause, resume and run-now for one pipeline phase; the Overview strip and the Workers tab share it. */
const AdminPhaseActions: React.FC<Props> = ({ phase, paused, implemented }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()

  const invalidatePhases = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
      queryClient.invalidateQueries({ queryKey: listCreditRegistrationPhasesQueryKey() }),
    ])

  const { pauseButton, resumeButton, dialog } = usePauseResumeAction({
    pause: (fields) => adminPausePhase({ path: { phase }, body: { reason: fields.reason } }),
    resume: () => adminResumePhase({ path: { phase }, body: { reason: null } }),
    invalidate: () => void invalidatePhases(),
    resumeConfirmMessage: t("credit-registration-admin-phase-resume-confirm", { phase }),
    pauseButtonLabel: t("button-text-credit-registration-phase-pause"),
    resumeButtonLabel: t("button-text-credit-registration-phase-resume"),
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

  return (
    <div className={pauseResumeRootCss}>
      {paused ? (
        resumeButton
      ) : (
        <>
          {pauseButton}
          <Button
            variant="tertiary"
            size="small"
            isLoading={runNowMutation.isPending}
            onClick={async () => {
              const confirmed = await confirm(
                t("credit-registration-admin-phase-run-now-confirm", { phase }),
              )
              if (confirmed) {
                runNowMutation.mutate()
              }
            }}
          >
            {t("button-text-credit-registration-phase-run-now")}
          </Button>
        </>
      )}
      {dialog}
    </div>
  )
}

export default AdminPhaseActions
