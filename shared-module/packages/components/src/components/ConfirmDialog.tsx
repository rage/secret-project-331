"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { omitUndefined } from "../lib/utils/nullability"
import { Dialog, type DialogAction, type DialogSize } from "./Dialog"
import { TextArea } from "./TextArea"

/** Config for the optional required-reason field. */
export interface ConfirmDialogReason {
  /** Field label, e.g. "Reason". */
  label: string
  /** Rendered below the field, e.g. "Recorded in the audit log with your name." */
  hint?: React.ReactNode
  /** Overrides the default validation message shown when the field is submitted blank. */
  requiredMessage?: string
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** One-sentence statement of what this action does, stated plainly. */
  description: React.ReactNode
  /** Label and accessible name of the primary action, e.g. "Cancel registration" — a verb phrase naming the action, not a generic acknowledgement. */
  confirmLabel: string
  /** Defaults to the shared "Cancel" label. */
  cancelLabel?: string
  /** Puts the primary action in the danger palette, for actions that cannot be undone. */
  isDestructive?: boolean
  /** Adds a required reason field; its trimmed value is passed to `onConfirm`. */
  reason?: ConfirmDialogReason
  onConfirm: (reason?: string) => void | Promise<void>
  /** Disables the primary action for a reason external to this dialog (e.g. content it depends on
   *  is still loading). Independent of the pending state `onConfirm` drives internally. */
  isConfirmDisabled?: boolean
  size?: DialogSize
  "data-testid"?: string
  /** Test ids for the Cancel and primary buttons, for callers migrating from a dialog whose e2e
   *  coverage already selects by id. */
  cancelTestId?: string
  confirmTestId?: string
}

interface ConfirmDialogFormValues {
  reason: string
}

/**
 * Preset over `Dialog` for admin action confirmations: states the consequence up front, collects a
 * required reason when one is asked for, and always renders Cancel plus a primary action labelled
 * with what it does.
 *
 * A blank required reason blocks submission with its own field error; the primary action is never
 * disabled to signal that. While `onConfirm` is pending, the dialog cannot be dismissed and the
 * primary action shows its loading state.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  reason,
  onConfirm,
  isConfirmDisabled = false,
  size,
  "data-testid": dataTestId,
  cancelTestId,
  confirmTestId,
}) => {
  const { t } = useTranslation("shared-module")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { control, handleSubmit } = useForm<ConfirmDialogFormValues>({
    defaultValues: { reason: "" },
  })

  const runConfirm = async (reasonValue?: string) => {
    setIsSubmitting(true)
    try {
      await onConfirm(reasonValue)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrimaryPress = () => {
    if (reason) {
      void handleSubmit((values) => runConfirm(values.reason.trim()))()
    } else {
      void runConfirm(undefined)
    }
  }

  const actions: readonly [DialogAction, DialogAction] = [
    {
      label: cancelLabel ?? t("button-cancel"),
      variant: "tertiary",
      disabled: isSubmitting,
      onPress: onClose,
      ...omitUndefined({ "data-testid": cancelTestId }),
    },
    {
      label: confirmLabel,
      variant: isDestructive ? "destructive" : "primary",
      isLoading: isSubmitting,
      disabled: isConfirmDisabled,
      onPress: handlePrimaryPress,
      ...omitUndefined({ "data-testid": confirmTestId }),
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      isDismissable={!isSubmitting}
      showCloseButton={!isSubmitting}
      actions={actions}
      {...omitUndefined({ size, "data-testid": dataTestId })}
    >
      <div>{description}</div>
      {reason ? (
        <TextArea<ConfirmDialogFormValues>
          name="reason"
          control={control}
          label={reason.label}
          isRequired
          rules={{
            validate: (value) =>
              value.trim().length > 0 ||
              reason.requiredMessage ||
              t("confirmDialog.reasonRequired"),
          }}
          {...omitUndefined({ description: reason.hint })}
        />
      ) : null}
    </Dialog>
  )
}
