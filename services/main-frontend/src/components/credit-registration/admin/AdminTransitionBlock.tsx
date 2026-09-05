"use client"

import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCreditRegistrationForAdminQueryKey,
  getCreditRegistrationOverviewQueryKey,
  listCreditRegistrationsForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminTransitionCreditRegistration } from "@/generated/api/sdk.generated"
import type {
  AdminCreditRegistrationRow,
  AdminTransitionCreditRegistrationResult,
} from "@/generated/api/types.generated"
import type { ButtonVariant } from "@/shared-module/components"
import { Infobox } from "@/shared-module/components"

import { TONE } from "../constants"
import { refusalSentence } from "../resubmissionRefusal"
import { noteCss, rowCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import { ReasonField } from "./ReasonConfirmDialog"
import type { TransitionChoice } from "./TransitionTargetSelect"
import {
  CANCELLED,
  CHECK_NOW,
  CLEAR_ATTENTION,
  READY_TO_SUBMIT,
  transitionAction,
} from "./TransitionTargetSelect"

interface Props {
  registration: AdminCreditRegistrationRow
}

interface Fields {
  action: TransitionChoice
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const SUBMISSION_UNCERTAIN = "submission_uncertain"
// oxlint-disable-next-line i18next/no-literal-string
const APPLIED = "applied" as const
// oxlint-disable-next-line i18next/no-literal-string
const REFUSED = "refused" as const

interface TransitionActionProps {
  registration: AdminCreditRegistrationRow
  choice: TransitionChoice
  label: string
  appliedMessage: string
  variant: ButtonVariant
}

const TransitionAction: React.FC<TransitionActionProps> = ({
  registration,
  choice,
  label,
  appliedMessage,
  variant,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return (
    <AdminActionDialog<Fields, AdminTransitionCreditRegistrationResult>
      triggerLabel={label}
      triggerVariant={variant}
      dialogTitle={label}
      defaultValues={{ action: choice, reason: "" }}
      mutationFn={(fields) =>
        adminTransitionCreditRegistration({
          path: { credit_registration_id: registration.id },
          body: { action: transitionAction(fields.action), reason: fields.reason },
        })
      }
      onSuccess={() => {
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: getCreditRegistrationForAdminQueryKey({
              path: { credit_registration_id: registration.id },
            }),
          }),
          queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
        ])
      }}
      renderFields={(control) => (
        <ReasonField
          control={control}
          description={t("description-credit-registration-transition-reason")}
        />
      )}
      renderResult={(result) => (
        <Infobox tone={result.outcome === APPLIED ? TONE.INFO : TONE.WARNING}>
          {result.outcome === REFUSED ? refusalSentence(t, result.refusal) : appliedMessage}
        </Infobox>
      )}
    />
  )
}

/** The hand actions an admin has on one row; a refused one comes back saying why. */
const AdminTransitionBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()

  if (registration.superseded) {
    return <p className={noteCss}>{t("credit-registration-admin-superseded-no-actions")}</p>
  }

  return (
    <>
      {registration.state === SUBMISSION_UNCERTAIN && (
        <Infobox tone={TONE.WARNING}>{t("credit-registration-admin-uncertain-warning")}</Infobox>
      )}
      <div className={rowCss}>
        <TransitionAction
          registration={registration}
          choice={READY_TO_SUBMIT}
          label={t("credit-registration-admin-target-resubmit")}
          appliedMessage={t("credit-registration-admin-resubmit-applied")}
          variant="primary"
        />
        <TransitionAction
          registration={registration}
          choice={CHECK_NOW}
          label={t("credit-registration-admin-target-check-now")}
          appliedMessage={t("credit-registration-admin-check-now-applied")}
          variant="secondary"
        />
        {registration.needs_admin_attention && (
          <TransitionAction
            registration={registration}
            choice={CLEAR_ATTENTION}
            label={t("credit-registration-admin-target-clear-attention")}
            appliedMessage={t("credit-registration-admin-attention-cleared")}
            variant="tertiary"
          />
        )}
        <TransitionAction
          registration={registration}
          choice={CANCELLED}
          label={t("credit-registration-admin-target-cancel")}
          appliedMessage={t("credit-registration-admin-cancel-applied")}
          variant="tertiary"
        />
      </div>
    </>
  )
}

export default AdminTransitionBlock
