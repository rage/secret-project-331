"use client"

import React, { useEffect } from "react"
import type { Control, DefaultValues, FieldValues, Path } from "react-hook-form"
import { useController, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationAdminAction } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { ConfirmDialog, Select, TextArea } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { useEarlierReasons } from "./adminCreditRegistrationHooks"
import { AUDIT_ACTION } from "./auditActions"

export interface WithReason {
  reason: string
}

/** Every reason-confirm form shares this shape: seed values plus a `reason` field to validate. */
export function useReasonRequiredForm<T extends FieldValues & WithReason>(defaultValues: T) {
  // RHF's `DefaultValues<T>` deep-partials nested objects; our forms are flat, so a plain T fits.
  return useForm<T>({ defaultValues: defaultValues as DefaultValues<T> })
}

const REASON_FIELD = "reason"

/** The label of the text an action is recorded with: a note is not a reason for anything. */
const useReasonLabels = (auditAction: CreditRegistrationAdminAction) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isNote = auditAction === AUDIT_ACTION.ADD_NOTE
  return {
    field: t(isNote ? "label-note" : "label-reason"),
    earlier: t(
      isNote
        ? "credit-registration-admin-earlier-notes"
        : "credit-registration-admin-earlier-reasons",
    ),
  }
}

interface EarlierReasonPick {
  earlier: string
}

/** Offers the reasons given before for `auditAction`; picking one hands its text to `onPick`. */
const EarlierReasonPicker: React.FC<{
  auditAction: CreditRegistrationAdminAction
  onPick: (reason: string) => void
}> = ({ auditAction, onPick }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const labels = useReasonLabels(auditAction)
  const earlierReasons = useEarlierReasons(auditAction).data ?? []
  const picker = useForm<EarlierReasonPick>({ defaultValues: { earlier: "" } })
  const earlier = picker.watch("earlier")

  useEffect(() => {
    if (earlier !== "") {
      onPick(earlier)
      // Back to the placeholder, so picking the same one again after editing copies it again.
      picker.reset()
    }
  }, [earlier, onPick, picker])

  if (earlierReasons.length === 0) {
    return null
  }
  return (
    <Select<EarlierReasonPick>
      name="earlier"
      control={picker.control}
      label={labels.earlier}
      description={t("credit-registration-admin-earlier-reasons-description")}
      placeholder={t("credit-registration-admin-earlier-reasons-placeholder")}
      options={earlierReasons.map((reason) => ({ value: reason, label: reason }))}
      searchEnabled
    />
  )
}

interface ReasonFieldProps<T extends FieldValues & WithReason> {
  control: Control<T>
  /** The audit action the reason is recorded under; its earlier reasons are offered to pick from. */
  auditAction: CreditRegistrationAdminAction
  /** Replaces the shared audit-log line, where this action needs the reason to say something else. */
  description?: React.ReactNode
  isRequired?: boolean
}

/**
 * The reason an audited admin action is recorded with, in a form that has other fields too.
 *
 * Marks itself required rather than letting the caller disable its submit button: a greyed-out
 * button says nothing about what is missing.
 */
export function ReasonField<T extends FieldValues & WithReason>({
  control,
  auditAction,
  description,
  isRequired = true,
}: ReasonFieldProps<T>) {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const labels = useReasonLabels(auditAction)
  // TS can't verify a generic T contains "reason" from the WithReason bound alone.
  const name = REASON_FIELD as Path<T>
  const {
    field: { onChange: setReason },
  } = useController({ name, control })

  return (
    <>
      <EarlierReasonPicker auditAction={auditAction} onPick={setReason} />
      <TextArea
        name={name}
        control={control}
        label={labels.field}
        description={description ?? t("credit-registration-admin-reason-audit-hint")}
        isRequired={isRequired}
        {...includeIf(isRequired, {
          // Not `required`: a reason of only spaces passes it, and the server then refuses it.
          rules: { validate: (value: string) => value.trim() !== "" || t("required-field") },
        })}
      />
    </>
  )
}

interface ReasonConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** One sentence saying what confirming does, in the reader's terms. */
  description: React.ReactNode
  /** Verb phrase naming the action, e.g. "Unlink the number". */
  confirmLabel: string
  auditAction: CreditRegistrationAdminAction
  /** Replaces the shared audit-log line under the field. */
  reasonHint?: React.ReactNode
  /** Danger palette for an action that cannot be taken back. */
  isDestructive?: boolean
  /** Keeps a second submit from starting while the first is in flight. */
  isPending?: boolean
  onConfirm: (reason: string) => void
}

/** The simple case: a dialog whose only field is the reason. Forms with other fields use `ReasonField` directly. */
export const ReasonConfirmDialog: React.FC<ReasonConfirmDialogProps> = ({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  auditAction,
  reasonHint,
  isDestructive = false,
  isPending = false,
  onConfirm,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const labels = useReasonLabels(auditAction)

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      isDestructive={isDestructive}
      isConfirmDisabled={isPending}
      reason={{
        label: labels.field,
        hint: reasonHint ?? t("credit-registration-admin-reason-audit-hint"),
        renderAbove: (setReason) => (
          <EarlierReasonPicker auditAction={auditAction} onPick={setReason} />
        ),
      }}
      onConfirm={(reason) => onConfirm(reason ?? "")}
    />
  )
}
