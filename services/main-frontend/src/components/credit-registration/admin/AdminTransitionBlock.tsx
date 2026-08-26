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
  AdminCreditRegistrationTransitionTarget,
  AdminTransitionCreditRegistrationResult,
} from "@/generated/api/types.generated"
import { Infobox } from "@/shared-module/components"

import { TONE } from "../constants"
import { noteCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import { ReasonField } from "./ReasonConfirmDialog"
import { CHECK_NOW, READY_TO_SUBMIT, TransitionTargetSelect } from "./TransitionTargetSelect"

interface Props {
  registration: AdminCreditRegistrationRow
}

interface Fields {
  to_state: AdminCreditRegistrationTransitionTarget
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const SUBMISSION_UNCERTAIN = "submission_uncertain"
// oxlint-disable-next-line i18next/no-literal-string
const APPLIED = "applied" as const
// oxlint-disable-next-line i18next/no-literal-string
const REFUSED_WITHOUT_CONSENT = "refused_without_consent" as const

/** A resubmit is refused without consent, which is the case `misregistered` creates. */
const AdminTransitionBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  if (registration.superseded) {
    return <p className={noteCss}>{t("credit-registration-admin-superseded-no-actions")}</p>
  }

  const describeResult = (
    finished: AdminTransitionCreditRegistrationResult,
    fields: Fields,
  ): string => {
    if (finished.outcome === REFUSED_WITHOUT_CONSENT) {
      return t("credit-registration-admin-transition-refused-without-consent")
    }
    if (fields.to_state === CHECK_NOW) {
      return t("credit-registration-admin-check-now-applied")
    }
    return t("credit-registration-admin-transition-applied", { state: finished.state })
  }

  return (
    <>
      {registration.state === SUBMISSION_UNCERTAIN && (
        <Infobox tone={TONE.WARNING}>{t("credit-registration-admin-uncertain-warning")}</Infobox>
      )}
      <AdminActionDialog<Fields, AdminTransitionCreditRegistrationResult>
        triggerLabel={t("button-text-credit-registration-transition")}
        dialogTitle={t("button-text-credit-registration-transition")}
        defaultValues={{ to_state: READY_TO_SUBMIT, reason: "" }}
        mutationFn={(fields) =>
          adminTransitionCreditRegistration({
            path: { credit_registration_id: registration.id },
            body: { to_state: fields.to_state, reason: fields.reason },
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
          <>
            <TransitionTargetSelect control={control} />
            <ReasonField
              control={control}
              description={t("description-credit-registration-transition-reason")}
            />
          </>
        )}
        renderResult={(result, fields) => (
          <Infobox tone={result.outcome === APPLIED ? TONE.INFO : TONE.WARNING}>
            {describeResult(result, fields)}
          </Infobox>
        )}
      />
    </>
  )
}

export default AdminTransitionBlock
