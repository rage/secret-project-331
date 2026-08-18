"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { adminBulkTransitionCreditRegistrations } from "@/generated/api/sdk.generated"
import type {
  AdminBulkTransitionResult,
  AdminCreditRegistrationTransitionTarget,
} from "@/generated/api/types.generated"
import { Infobox, Select } from "@/shared-module/components"

import { TONE } from "../constants"
import { noteCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import { bulkSkipLabel } from "./adminCreditRegistrationCopy"
import { useInvalidateAttentionItems } from "./adminCreditRegistrationHooks"
import { ReasonField } from "./ReasonConfirmDialog"

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

/**
 * Moves every selected live row to one state. The server refuses rows whose submission outcome is
 * unknown and reports them as skipped; this dialog names every skip rather than reporting a total.
 */
const AdminBulkTransitionDialog: React.FC<Props> = ({ selectedIds, onApplied }) => {
  const { t } = useTranslation()
  const invalidateAttentionItems = useInvalidateAttentionItems()

  return (
    <AdminActionDialog<Fields, AdminBulkTransitionResult>
      triggerLabel={t("button-text-credit-registration-bulk-transition", {
        count: selectedIds.length,
      })}
      triggerDisabled={selectedIds.length === 0}
      dialogTitle={t("credit-registration-admin-bulk-transition-title", {
        count: selectedIds.length,
      })}
      defaultValues={{ to_state: READY_TO_SUBMIT, reason: "" }}
      mutationFn={(fields) =>
        adminBulkTransitionCreditRegistrations({
          body: {
            to_state: fields.to_state,
            credit_registration_ids: selectedIds,
            reason: fields.reason,
          },
        })
      }
      onSuccess={() => {
        onApplied()
        void invalidateAttentionItems()
      }}
      renderFields={(control) => (
        <>
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
        </>
      )}
      renderResult={(result) => (
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
    />
  )
}

export default AdminBulkTransitionDialog
