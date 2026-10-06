"use client"

import React from "react"
import type { Control } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { adminBulkTransitionCreditRegistrations } from "@/generated/api/sdk.generated"
import type { AdminBulkTransitionResult } from "@/generated/api/types.generated"
import { Checkbox, Infobox, Select } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, MIDDLE_DOT, TONE } from "../constants"
import { refusalSentence } from "../resubmissionRefusal"
import { noteCss, proseCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import { useInvalidateAttentionItems } from "./adminCreditRegistrationHooks"
import type { BulkTransitionRow } from "./bulkTransitionActions"
import {
  countResubmissionRisk,
  countSkipped,
  groupSelectionByState,
  selectionSummary,
} from "./bulkTransitionActions"
import { ReasonField } from "./ReasonConfirmDialog"
import type { TransitionChoice } from "./TransitionTargetSelect"
import {
  CANCELLED,
  CHECK_NOW,
  CLEAR_ATTENTION,
  READY_TO_SUBMIT,
  transitionAction,
} from "./TransitionTargetSelect"

/** One selected row: the id to move, plus what the server allows on it. */
export interface BulkSelectionRow extends BulkTransitionRow {
  credit_registration_id: string
}

interface Props {
  selectedRows: readonly BulkSelectionRow[]
  onApplied: () => void
}

const ACTION_FIELD = "action" as const

/** No action is chosen for the operator: over a mixed selection every default is wrong for some row. */
const NO_ACTION = "" as const

interface Fields {
  action: TransitionChoice | typeof NO_ACTION
  reason: string
  cancelUnderstood: boolean
  repeatUnderstood: boolean
}

const ACTION_LABEL_KEYS = {
  [READY_TO_SUBMIT]: "credit-registration-admin-target-resubmit",
  [CANCELLED]: "credit-registration-admin-target-cancel",
  [CLEAR_ATTENTION]: "credit-registration-admin-target-clear-attention",
  [CHECK_NOW]: "credit-registration-admin-target-check-now",
} as const satisfies Record<TransitionChoice, string>

const ACTION_DESCRIPTION_KEYS = {
  [READY_TO_SUBMIT]: "credit-registration-admin-resubmit-description",
  [CANCELLED]: "credit-registration-admin-cancel-description",
  [CLEAR_ATTENTION]: "credit-registration-admin-clear-attention-description",
  [CHECK_NOW]: "credit-registration-admin-check-now-bulk-description",
} as const satisfies Record<TransitionChoice, string>

const LIKELY_REJECTED_AGAIN = "likely_rejected_again" as const
const REPLACES_REVERSED_ATTAINMENT = "replaces_reversed_attainment" as const

const OFFERED_ACTIONS: readonly TransitionChoice[] = [
  READY_TO_SUBMIT,
  CHECK_NOW,
  CLEAR_ATTENTION,
  CANCELLED,
]

/**
 * What the chosen action does to this selection, and the confirmations it needs on top of the
 * reason: the reason field gates every action equally, so on its own it puts cancelling a hundred
 * rows on a par with dismissing their flags.
 */
const BulkActionNotes: React.FC<{
  control: Control<Fields>
  selectedRows: readonly BulkSelectionRow[]
}> = ({ control, selectedRows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const action = useWatch({ control, name: ACTION_FIELD })
  if (action === NO_ACTION) {
    return null
  }
  const uncertainCount = selectedRows.filter((row) => row.state === "submission_uncertain").length
  const repeatCount = countResubmissionRisk(LIKELY_REJECTED_AGAIN, selectedRows)
  const reversedCount = countResubmissionRisk(REPLACES_REVERSED_ATTAINMENT, selectedRows)
  return (
    <>
      <p className={proseCss}>{t(ACTION_DESCRIPTION_KEYS[action])}</p>
      {(action === READY_TO_SUBMIT || action === CANCELLED) && uncertainCount > 0 && (
        <p className={noteCss}>
          {t("credit-registration-admin-bulk-uncertain-note", { count: uncertainCount })}
        </p>
      )}
      {action === READY_TO_SUBMIT && reversedCount > 0 && (
        <Infobox tone={TONE.INFO}>
          {t("credit-registration-admin-bulk-reversed-count", { count: reversedCount })}
        </Infobox>
      )}
      {action === READY_TO_SUBMIT && repeatCount > 0 && (
        <>
          <Infobox tone={TONE.WARNING}>
            {t("credit-registration-admin-bulk-repeat-count", { count: repeatCount })}
          </Infobox>
          <Checkbox
            name="repeatUnderstood"
            control={control}
            rules={{ required: t("required-field") }}
            label={t("credit-registration-admin-resubmit-repeat-confirm")}
          />
        </>
      )}
      {action === CANCELLED && (
        <>
          <Infobox tone={TONE.DANGER}>{t("credit-registration-admin-bulk-cancel-warning")}</Infobox>
          <Checkbox
            name="cancelUnderstood"
            control={control}
            rules={{ required: t("required-field") }}
            label={t("credit-registration-admin-bulk-cancel-confirm", {
              count: selectedRows.length - countSkipped(CANCELLED, selectedRows),
            })}
          />
        </>
      )}
    </>
  )
}

/**
 * Moves every selected live row to one state.
 *
 * Which rows each action applies to is the server's per-row rule: an action names how many selected
 * rows it would skip, and is disabled only when it would skip them all. Nothing is preselected, so a
 * mixed selection cannot be resubmitted by pressing Confirm.
 */
const AdminBulkTransitionDialog: React.FC<Props> = ({ selectedRows, onApplied }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateAttentionItems = useInvalidateAttentionItems()
  const selectedIds = selectedRows.map((row) => row.credit_registration_id)
  const groups = groupSelectionByState(selectedRows)

  return (
    <AdminActionDialog<Fields, AdminBulkTransitionResult>
      triggerLabel={t("button-text-credit-registration-bulk-transition", {
        count: selectedIds.length,
      })}
      triggerDisabled={selectedIds.length === 0}
      dialogTitle={t("credit-registration-admin-bulk-transition-title", {
        count: selectedIds.length,
      })}
      description={t("credit-registration-admin-bulk-transition-description", {
        count: selectedIds.length,
      })}
      confirmLabel={t("credit-registration-admin-bulk-transition-confirm")}
      defaultValues={{
        action: NO_ACTION,
        reason: "",
        cancelUnderstood: false,
        repeatUnderstood: false,
      }}
      mutationFn={(fields) =>
        adminBulkTransitionCreditRegistrations({
          body: {
            // The field is required, so a submit with nothing chosen never reaches this.
            action: transitionAction(fields.action as TransitionChoice),
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
          <Select
            name={ACTION_FIELD}
            control={control}
            label={t("label-credit-registration-transition-target")}
            placeholder={t("credit-registration-admin-bulk-choose-action")}
            rules={{ required: t("required-field") }}
            options={OFFERED_ACTIONS.map((action) => {
              const skipped = countSkipped(action, selectedRows)
              const label = t(ACTION_LABEL_KEYS[action])
              return {
                value: action,
                label:
                  skipped === 0
                    ? label
                    : `${label}${MIDDLE_DOT}${t("credit-registration-admin-bulk-blocked-rows", {
                        count: skipped,
                      })}`,
                textValue: label,
                isDisabled: skipped === selectedRows.length,
              }
            })}
          />
          <p className={noteCss}>{selectionSummary(t, groups).join(MIDDLE_DOT)}</p>
          <BulkActionNotes control={control} selectedRows={selectedRows} />
          <ReasonField control={control} />
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
