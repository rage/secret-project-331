"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getCreditRegistrationOverviewQueryKey,
  listCreditRegistrationPhasesQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminPausePhase, adminResumePhase, adminRunPhaseNow } from "@/generated/api/sdk.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button } from "@/shared-module/components"

import { ReasonConfirmDialog } from "./ReasonConfirmDialog"

interface Props {
  phase: string
  paused: boolean
  implemented: boolean
}

const rootCss = css`
  display: flex;
  gap: 0.4rem;
`

/** Pause, resume and run-now for one pipeline phase; the Overview strip and the Workers tab share it. */
const AdminPhaseActions: React.FC<Props> = ({ phase, paused, implemented }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()
  const [pauseOpen, setPauseOpen] = useState(false)

  const invalidatePhases = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
      queryClient.invalidateQueries({ queryKey: listCreditRegistrationPhasesQueryKey() }),
    ])

  const pauseMutation = useToastMutation(
    (fields: { reason: string }) =>
      adminPausePhase({ path: { phase }, body: { reason: fields.reason } }),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setPauseOpen(false)
        void invalidatePhases()
      },
    },
  )
  const resumeMutation = useToastMutation(
    () => adminResumePhase({ path: { phase }, body: { reason: null } }),
    { notify: true, method: "POST" },
    { onSuccess: () => void invalidatePhases() },
  )
  const runNowMutation = useToastMutation(
    () => adminRunPhaseNow({ path: { phase }, body: { reason: null } }),
    { notify: true, method: "POST" },
    { onSuccess: () => void invalidatePhases() },
  )

  if (!implemented) {
    return null
  }

  return (
    <div className={rootCss}>
      {paused ? (
        <Button
          variant="tertiary"
          size="small"
          isLoading={resumeMutation.isPending}
          onClick={async () => {
            const confirmed = await confirm(
              t("credit-registration-admin-phase-resume-confirm", { phase }),
            )
            if (confirmed) {
              resumeMutation.mutate()
            }
          }}
        >
          {t("button-text-credit-registration-phase-resume")}
        </Button>
      ) : (
        <>
          <Button variant="tertiary" size="small" onClick={() => setPauseOpen(true)}>
            {t("button-text-credit-registration-phase-pause")}
          </Button>
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
      <ReasonConfirmDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title={t("credit-registration-admin-phase-pause-title", { phase })}
        reasonDescription={t("credit-registration-admin-phase-pause-reason-description")}
        isPending={pauseMutation.isPending}
        onConfirm={(reason) => pauseMutation.mutate({ reason })}
      />
    </div>
  )
}

export default AdminPhaseActions
