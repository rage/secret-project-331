"use client"

import React from "react"
import type { Control, DefaultValues, FieldValues, Path } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"
import { Button, Dialog, TextArea } from "@/shared-module/components"

import { dialogFormCss } from "../styles"

export interface WithReason {
  reason: string
}

/** Every reason-confirm form shares this shape: seed values plus a `reason` field to validate. */
export function useReasonRequiredForm<T extends FieldValues & WithReason>(defaultValues: T) {
  // RHF's `DefaultValues<T>` deep-partials nested objects; our forms are flat, so a plain T fits.
  return useForm<T>({ defaultValues: defaultValues as DefaultValues<T> })
}

export const isReasonConfirmDisabled = (
  isPending: boolean,
  reason: string,
  isReasonRequired = true,
): boolean => isPending || (isReasonRequired && reason.trim() === "")

interface ReasonFieldProps<T extends FieldValues & WithReason> {
  control: Control<T>
  description?: React.ReactNode
  isRequired?: boolean
}

export function ReasonField<T extends FieldValues & WithReason>({
  control,
  description,
  isRequired = true,
}: ReasonFieldProps<T>) {
  const { t } = useTranslation()
  return (
    <TextArea
      // TS can't verify a generic T contains "reason" from the WithReason bound alone.
      name={"reason" as Path<T>}
      control={control}
      label={t("label-reason")}
      {...omitUndefined({ description })}
      {...includeIf(isRequired, { rules: { required: t("required-field") } })}
    />
  )
}

interface ReasonConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  message?: React.ReactNode
  reasonDescription?: React.ReactNode
  confirmLabel?: string
  isPending: boolean
  onConfirm: (reason: string) => void
}

/** The simple case: a dialog whose only field is the reason. Forms with other fields use `ReasonField` directly. */
export const ReasonConfirmDialog: React.FC<ReasonConfirmDialogProps> = ({
  open,
  onClose,
  title,
  message,
  reasonDescription,
  confirmLabel,
  isPending,
  onConfirm,
}) => {
  const { t } = useTranslation()
  const { control, handleSubmit, watch } = useReasonRequiredForm<WithReason>({ reason: "" })
  const reason = watch("reason")

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form className={dialogFormCss} onSubmit={handleSubmit((fields) => onConfirm(fields.reason))}>
        {message && <p>{message}</p>}
        <ReasonField control={control} description={reasonDescription} />
        <Button
          variant="primary"
          size="medium"
          type="submit"
          disabled={isReasonConfirmDisabled(isPending, reason)}
        >
          {confirmLabel ?? t("button-text-confirm")}
        </Button>
      </form>
    </Dialog>
  )
}
