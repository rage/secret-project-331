"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { adminBulkTransitionCreditRegistrations } from "@/generated/api/sdk.generated"
import type { AdminBulkTransitionResult } from "@/generated/api/types.generated"
import { Infobox } from "@/shared-module/components"

import { TONE } from "../constants"
import { refusalSentence } from "../resubmissionRefusal"
import { noteCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import { useInvalidateAttentionItems } from "./adminCreditRegistrationHooks"
import { ReasonField } from "./ReasonConfirmDialog"
import type { TransitionChoice } from "./TransitionTargetSelect"
import { READY_TO_SUBMIT, transitionAction, TransitionTargetSelect } from "./TransitionTargetSelect"

interface Props {
  selectedIds: string[]
  onApplied: () => void
}

interface Fields {
  action: TransitionChoice
  reason: string
}

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
      defaultValues={{ action: READY_TO_SUBMIT, reason: "" }}
      mutationFn={(fields) =>
        adminBulkTransitionCreditRegistrations({
          body: {
            action: transitionAction(fields.action),
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
          <TransitionTargetSelect control={control} />
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
            <p key={skip.refusal}>
              {t("credit-registration-admin-bulk-skipped", {
                count: skip.count,
                reason: refusalSentence(t, skip.refusal),
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
