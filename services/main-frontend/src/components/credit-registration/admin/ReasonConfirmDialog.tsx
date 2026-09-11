"use client"

import React from "react"
import type { Control, DefaultValues, FieldValues, Path } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { includeIf } from "@/shared-module/common/utils/nullability"
import { ConfirmDialog, TextArea } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"

export interface WithReason {
  reason: string
}

/** Every reason-confirm form shares this shape: seed values plus a `reason` field to validate. */
export function useReasonRequiredForm<T extends FieldValues & WithReason>(defaultValues: T) {
  // RHF's `DefaultValues<T>` deep-partials nested objects; our forms are flat, so a plain T fits.
  return useForm<T>({ defaultValues: defaultValues as DefaultValues<T> })
}

interface ReasonFieldProps<T extends FieldValues & WithReason> {
  control: Control<T>
  /** Replaces the shared audit-log line, where this action needs the reason to say something else. */
  description?: React.ReactNode
  isRequired?: boolean
}

/**
 * The reason an audited admin action is recorded with.
 *
 * Marks itself required rather than letting the caller disable its submit button: a greyed-out
 * button says nothing about what is missing.
 */
export function ReasonField<T extends FieldValues & WithReason>({
  control,
  description,
  isRequired = true,
}: ReasonFieldProps<T>) {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <TextArea
      // TS can't verify a generic T contains "reason" from the WithReason bound alone.
      name={"reason" as Path<T>}
      control={control}
      label={t("label-reason")}
      description={description ?? t("credit-registration-admin-reason-audit-hint")}
      isRequired={isRequired}
      {...includeIf(isRequired, { rules: { required: t("required-field") } })}
    />
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
  reasonHint,
  isDestructive = false,
  isPending = false,
  onConfirm,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

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
        label: t("label-reason"),
        hint: reasonHint ?? t("credit-registration-admin-reason-audit-hint"),
      }}
      onConfirm={(reason) => onConfirm(reason ?? "")}
    />
  )
}
