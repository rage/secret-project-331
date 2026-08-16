"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { adminBulkTransitionCreditRegistrations } from "@/generated/api/sdk.generated"
import type {
  AdminBulkTransitionResult,
  AdminCreditRegistrationTransitionTarget,
} from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Dialog, Infobox, Select } from "@/shared-module/components"

import { TONE } from "../constants"
import { noteCss } from "../styles"
import { bulkSkipLabel } from "./adminCreditRegistrationCopy"
import { useInvalidateAttentionItems } from "./adminCreditRegistrationHooks"
import { ReasonField, isReasonConfirmDisabled, useReasonRequiredForm } from "./ReasonConfirmDialog"

interface Props {
  selectedIds: string[]
  onApplied: () => void
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

const formCss = css`
  display: grid;
  gap: 0.75rem;
`

const rootCss = css`
  display: grid;
  gap: 0.75rem;
  justify-items: start;
`

/**
 * Moves every selected live row to one state. The server refuses rows whose submission outcome is
 * unknown and reports them as skipped; this dialog names every skip rather than reporting a total.
 */
const AdminBulkTransitionDialog: React.FC<Props> = ({ selectedIds, onApplied }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<AdminBulkTransitionResult | null>(null)
  const invalidateAttentionItems = useInvalidateAttentionItems()
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>({
    to_state: READY_TO_SUBMIT,
    reason: "",
  })
  const reason = watch("reason")

  const mutation = useToastMutation(
    (fields: Fields) =>
      adminBulkTransitionCreditRegistrations({
        body: {
          to_state: fields.to_state,
          credit_registration_ids: selectedIds,
          reason: fields.reason,
        },
      }),
    { notify: false },
    {
      onSuccess: (data) => {
        setResult(data)
        setOpen(false)
        onApplied()
        void invalidateAttentionItems()
      },
    },
  )

  return (
    <div className={rootCss}>
      <Button
        variant="secondary"
        size="medium"
        disabled={selectedIds.length === 0}
        onClick={() => setOpen(true)}
      >
        {t("button-text-credit-registration-bulk-transition", { count: selectedIds.length })}
      </Button>
      {result && (
        <Infobox
          tone={result.skipped.length > 0 || result.not_found_count > 0 ? TONE.WARNING : TONE.INFO}
        >
          <p>{t("credit-registration-admin-bulk-applied", { count: result.applied_count })}</p>
          {result.skipped.map((skip) => (
            <p key={skip.reason}>
              {t("credit-registration-admin-bulk-skipped", {
                count: skip.count,
                reason: bulkSkipLabel(t, skip.reason),
              })}
            </p>
          ))}
          {result.not_found_count > 0 && (
            <p>
              {t("credit-registration-admin-bulk-not-found", { count: result.not_found_count })}
            </p>
          )}
        </Infobox>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("credit-registration-admin-bulk-transition-title", { count: selectedIds.length })}
      >
        <form className={formCss} onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
          <p className={noteCss}>{t("credit-registration-admin-bulk-uncertain-note")}</p>
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
          <ReasonField
            control={control}
            description={t("description-credit-registration-transition-reason")}
          />
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={isReasonConfirmDisabled(mutation.isPending, reason)}
          >
            {t("button-text-confirm")}
          </Button>
        </form>
      </Dialog>
    </div>
  )
}

export default AdminBulkTransitionDialog
