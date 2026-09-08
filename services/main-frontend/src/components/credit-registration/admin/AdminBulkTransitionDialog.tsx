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
import { noteCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import { useInvalidateAttentionItems } from "./adminCreditRegistrationHooks"
import type { BulkTransitionRow } from "./bulkTransitionActions"
import { countBlocking, groupSelectionByState, selectionSummary } from "./bulkTransitionActions"
import { ReasonField } from "./ReasonConfirmDialog"
import type { TransitionChoice } from "./TransitionTargetSelect"
import {
  CANCELLED,
  CHECK_NOW,
  CLEAR_ATTENTION,
  READY_TO_SUBMIT,
  transitionAction,
} from "./TransitionTargetSelect"

/** One selected row: the id to move, plus what decides whether each action can help it. */
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
}

const ACTION_LABEL_KEYS = {
  [READY_TO_SUBMIT]: "credit-registration-admin-target-resubmit",
  [CANCELLED]: "credit-registration-admin-target-cancel",
  [CLEAR_ATTENTION]: "credit-registration-admin-target-clear-attention",
  [CHECK_NOW]: "credit-registration-admin-target-check-now",
} as const satisfies Record<TransitionChoice, string>

const OFFERED_ACTIONS: readonly TransitionChoice[] = [
  READY_TO_SUBMIT,
  CHECK_NOW,
  CLEAR_ATTENTION,
  CANCELLED,
]

/**
 * A second, explicit gate on the one bulk move that cannot be undone: the reason field gates every
 * action in this dialog equally, so on its own it puts cancelling a hundred rows on a par with
 * resubmitting them.
 */
const BulkCancelGate: React.FC<{ control: Control<Fields>; count: number }> = ({
  control,
  count,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
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
 * Moves every selected live row to one state.
 *
 * The action list is built from the selection: an action no selected row can use is offered
 * disabled, naming how many rows block it, rather than silently doing nothing to them. Nothing is
 * preselected, so a mixed selection cannot be resubmitted by pressing Confirm.
 */
const AdminBulkTransitionDialog: React.FC<Props> = ({ selectedRows, onApplied }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateAttentionItems = useInvalidateAttentionItems()
  const selectedIds = selectedRows.map((row) => row.credit_registration_id)
  const groups = groupSelectionByState(selectedRows)
  const uncertainCount = selectedRows.filter((row) => row.state === "submission_uncertain").length

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
      defaultValues={{ action: NO_ACTION, reason: "", cancelUnderstood: false }}
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
              const blocking = countBlocking(action, selectedRows)
              const label = t(ACTION_LABEL_KEYS[action])
              return {
                value: action,
                label:
                  blocking === 0
                    ? label
                    : `${label}${MIDDLE_DOT}${t("credit-registration-admin-bulk-blocked-rows", {
                        count: blocking,
                      })}`,
                textValue: label,
                isDisabled: blocking > 0,
              }
            })}
          />
          <p className={noteCss}>{selectionSummary(t, groups).join(MIDDLE_DOT)}</p>
          {uncertainCount > 0 && (
            <p className={noteCss}>
              {t("credit-registration-admin-bulk-uncertain-note", { count: uncertainCount })}
            </p>
          )}
          <BulkCancelGate control={control} count={selectedIds.length} />
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
