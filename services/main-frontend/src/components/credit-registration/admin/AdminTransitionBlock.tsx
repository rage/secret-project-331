"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
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
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Dialog, Infobox, Select, TextArea } from "@/shared-module/components"

import { TONE } from "../constants"
import { noteCss } from "../styles"

interface Props {
  registration: AdminCreditRegistrationRow
}

interface Fields {
  to_state: AdminCreditRegistrationTransitionTarget
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const READY_TO_SUBMIT = "ready_to_submit" as const
// oxlint-disable-next-line i18next/no-literal-string
const CANCELLED = "cancelled" as const
// oxlint-disable-next-line i18next/no-literal-string
const CLEAR_ATTENTION = "clear_needs_admin_attention" as const
// oxlint-disable-next-line i18next/no-literal-string
const CHECK_NOW = "check_now" as const
// oxlint-disable-next-line i18next/no-literal-string
const SUBMISSION_UNCERTAIN = "submission_uncertain"

const rootCss = css`
  display: grid;
  gap: 0.75rem;
  justify-items: start;
`

const formCss = css`
  display: grid;
  gap: 0.75rem;
`

/** A resubmit is refused without consent, which is the case `misregistered` creates. */
const AdminTransitionBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<AdminTransitionCreditRegistrationResult | null>(null)
  const [appliedTarget, setAppliedTarget] =
    useState<AdminCreditRegistrationTransitionTarget | null>(null)
  const { control, handleSubmit, watch } = useForm<Fields>({
    defaultValues: { to_state: READY_TO_SUBMIT, reason: "" },
  })
  const reason = watch("reason")

  const mutation = useToastMutation(
    (fields: Fields) =>
      adminTransitionCreditRegistration({
        path: { credit_registration_id: registration.id },
        body: { to_state: fields.to_state, reason: fields.reason },
      }),
    { notify: false },
    {
      onSuccess: (data, fields) => {
        setResult(data)
        setAppliedTarget(fields.to_state)
        setOpen(false)
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: getCreditRegistrationForAdminQueryKey({
              path: { credit_registration_id: registration.id },
            }),
          }),
          queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
        ])
      },
    },
  )

  if (registration.superseded) {
    return <p className={noteCss}>{t("credit-registration-admin-superseded-no-actions")}</p>
  }

  const describeResult = (finished: AdminTransitionCreditRegistrationResult): string => {
    if (finished.outcome === "refused_without_consent") {
      return t("credit-registration-admin-transition-refused-without-consent")
    }
    if (appliedTarget === CHECK_NOW) {
      return t("credit-registration-admin-check-now-applied")
    }
    return t("credit-registration-admin-transition-applied", { state: finished.state })
  }

  return (
    <div className={rootCss}>
      {registration.state === SUBMISSION_UNCERTAIN && (
        <Infobox tone={TONE.WARNING}>{t("credit-registration-admin-uncertain-warning")}</Infobox>
      )}
      <Button variant="secondary" size="medium" onClick={() => setOpen(true)}>
        {t("button-text-credit-registration-transition")}
      </Button>
      {result && (
        <Infobox tone={result.outcome === "applied" ? TONE.INFO : TONE.WARNING}>
          {describeResult(result)}
        </Infobox>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("button-text-credit-registration-transition")}
      >
        <form
          className={formCss}
          onSubmit={handleSubmit((fields) => mutation.mutate(fields))}
          id="credit-registration-transition-form"
        >
          <Select
            name="to_state"
            control={control}
            label={t("label-credit-registration-transition-target")}
            options={[
              { value: READY_TO_SUBMIT, label: t("credit-registration-admin-target-resubmit") },
              { value: CANCELLED, label: t("credit-registration-admin-target-cancel") },
              {
                value: CLEAR_ATTENTION,
                label: t("credit-registration-admin-target-clear-attention"),
              },
              { value: CHECK_NOW, label: t("credit-registration-admin-target-check-now") },
            ]}
          />
          <TextArea
            name="reason"
            control={control}
            label={t("label-reason")}
            description={t("description-credit-registration-transition-reason")}
            rules={{ required: t("required-field") }}
          />
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={mutation.isPending || reason.trim() === ""}
          >
            {t("button-text-confirm")}
          </Button>
        </form>
      </Dialog>
    </div>
  )
}

export default AdminTransitionBlock
