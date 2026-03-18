"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import StandardDialog from "./StandardDialog"
import {
  CONFIRM_DIALOG_NO_BUTTON_TEST_ID,
  CONFIRM_DIALOG_YES_BUTTON_TEST_ID,
  DIALOG_PROVIDER_DIALOG_TEST_ID,
} from "./dialogTestIds"

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  yesButtonLabel?: string
  noButtonLabel?: string
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  noButtonLabel,
  yesButtonLabel,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation()
  return (
    <StandardDialog
      data-testid={DIALOG_PROVIDER_DIALOG_TEST_ID}
      open={open}
      onClose={onCancel}
      title={title}
      closeable={false}
      buttons={[
        {
          children: noButtonLabel ?? t("no"),
          variant: "secondary",
          onClick: onCancel,
          "data-testid": CONFIRM_DIALOG_NO_BUTTON_TEST_ID,
        },
        {
          children: yesButtonLabel ?? t("yes"),
          variant: "primary",
          onClick: onConfirm,
          disabled: confirmDisabled,
          "data-testid": CONFIRM_DIALOG_YES_BUTTON_TEST_ID,
        },
      ]}
    >
      {message}
    </StandardDialog>
  )
}

export default React.memo(ConfirmDialog)
