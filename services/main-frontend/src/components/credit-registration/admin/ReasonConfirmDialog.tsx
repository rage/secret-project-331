"use client"

import React, { useEffect } from "react"
import type { Control, DefaultValues, FieldValues, Path } from "react-hook-form"
import { useController, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationAdminAction } from "@/generated/api/types.generated"
import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"
import type { DialogAction } from "@/shared-module/components"
import { Dialog, Select, TextArea } from "@/shared-module/components"

import { BUTTON_DANGER, BUTTON_PRIMARY, CREDIT_REGISTRATION_NS } from "../constants"
import { dialogFormCss, proseCss } from "../styles"
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

interface ReasonFieldProps<T extends FieldValues & WithReason> {
  control: Control<T>
  /** The audit action the reason is recorded under; its earlier reasons are offered to pick from. */
  auditAction: CreditRegistrationAdminAction
  /** Replaces "Reason", where the text is something else, such as a note. */
  label?: string
  /** Replaces the shared audit-log line, where this action needs the reason to say something else. */
  description?: React.ReactNode
  isRequired?: boolean
}

const REASON_FIELD = "reason"

interface EarlierReasonPick {
  earlier: string
}

/**
 * The reason an audited admin action is recorded with, under a picker that copies in one given
 * before for the same action.
 *
 * Marks itself required rather than letting the caller disable its submit button: a greyed-out
 * button says nothing about what is missing.
 */
export function ReasonField<T extends FieldValues & WithReason>({
  control,
  auditAction,
  label,
  description,
  isRequired = true,
}: ReasonFieldProps<T>) {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  // TS can't verify a generic T contains "reason" from the WithReason bound alone.
  const name = REASON_FIELD as Path<T>
  const {
    field: { onChange: setReason },
  } = useController({ name, control })
  const earlierReasons = useEarlierReasons(auditAction).data ?? []
  const picker = useForm<EarlierReasonPick>({ defaultValues: { earlier: "" } })
  const earlier = picker.watch("earlier")
  const isNote = auditAction === AUDIT_ACTION.ADD_NOTE

  useEffect(() => {
    if (earlier !== "") {
      setReason(earlier)
      // Back to the placeholder, so picking the same one again after editing copies it again.
      picker.reset()
    }
  }, [earlier, setReason, picker])

  return (
    <>
      {earlierReasons.length > 0 && (
        <Select<EarlierReasonPick>
          name="earlier"
          control={picker.control}
          label={t(
            isNote
              ? "credit-registration-admin-earlier-notes"
              : "credit-registration-admin-earlier-reasons",
          )}
          description={t("credit-registration-admin-earlier-reasons-description")}
          placeholder={t("credit-registration-admin-earlier-reasons-placeholder")}
          options={earlierReasons.map(({ reason }) => ({ value: reason, label: reason }))}
          searchEnabled
        />
      )}
      <TextArea
        name={name}
        control={control}
        label={label ?? t("label-reason")}
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
  /** Replaces "Reason", where the text is something else, such as a note. */
  reasonLabel?: string
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
  reasonLabel,
  reasonHint,
  isDestructive = false,
  isPending = false,
  onConfirm,
}) => {
  const { control, handleSubmit, reset } = useReasonRequiredForm<WithReason>({ reason: "" })
  // The dialog stays mounted between uses, so it would reopen with the text last sent.
  useEffect(() => {
    if (open) {
      reset()
    }
  }, [open, reset])
  const submit = handleSubmit(({ reason }) => onConfirm(reason.trim()))
  const actions: readonly [DialogAction] = [
    {
      label: confirmLabel,
      variant: isDestructive ? BUTTON_DANGER : BUTTON_PRIMARY,
      isLoading: isPending,
      onPress: () => void submit(),
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      actions={actions}
      showCloseButton={!isPending}
    >
      <form className={dialogFormCss} onSubmit={submit}>
        <div className={proseCss}>{description}</div>
        <ReasonField
          control={control}
          auditAction={auditAction}
          {...omitUndefined({ label: reasonLabel, description: reasonHint })}
        />
      </form>
    </Dialog>
  )
}
