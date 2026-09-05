"use client"

import React from "react"
import type { Control } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { adminBulkTransitionCreditRegistrations } from "@/generated/api/sdk.generated"
import type { AdminBulkTransitionResult } from "@/generated/api/types.generated"
import { Checkbox, Infobox } from "@/shared-module/components"

import { TONE } from "../constants"
import { refusalSentence } from "../resubmissionRefusal"
import { noteCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import { useInvalidateAttentionItems } from "./adminCreditRegistrationHooks"
import { ReasonField } from "./ReasonConfirmDialog"
import type { TransitionChoice } from "./TransitionTargetSelect"
import {
  CANCELLED,
  READY_TO_SUBMIT,
  transitionAction,
  TransitionTargetSelect,
} from "./TransitionTargetSelect"

interface Props {
  selectedIds: string[]
  onApplied: () => void
}

// oxlint-disable-next-line i18next/no-literal-string
const ACTION_FIELD = "action" as const

interface Fields {
  action: TransitionChoice
  reason: string
  cancelUnderstood: boolean
}

/**
 * A second, explicit gate on the one bulk move that cannot be undone: the reason field gates every
 * action in this dialog equally, so on its own it puts cancelling a hundred rows on a par with
 * resubmitting them.
 */
const BulkCancelGate: React.FC<{ control: Control<Fields>; count: number }> = ({
  control,
  count,
}) => {
  const { t } = useTranslation()
  const action = useWatch({ control, name: ACTION_FIELD })
  if (action !== CANCELLED) {
    return null
  }
  return (
    <>
      <Infobox tone={TONE.DANGER}>{t("credit-registration-admin-bulk-cancel-warning")}</Infobox>
      <Checkbox
        name="cancelUnderstood"
        control={control}
        rules={{ required: t("required-field") }}
        label={t("credit-registration-admin-bulk-cancel-confirm", { count })}
      />
    </>
  )
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
      defaultValues={{ action: READY_TO_SUBMIT, reason: "", cancelUnderstood: false }}
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
          <BulkCancelGate control={control} count={selectedIds.length} />
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
