"use client"

import React from "react"
import { useTranslation } from "react-i18next"

// Imported by module, never through the package barrel: this file is synced into every
// service, and the barrel would make each one type-check the whole component package and
// declare its react-stately dependencies.
import { ConfirmDialog as SharedConfirmDialog } from "@/shared-module/components/components/ConfirmDialog"

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
    <SharedConfirmDialog
      data-testid={DIALOG_PROVIDER_DIALOG_TEST_ID}
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      confirmLabel={yesButtonLabel ?? t("yes")}
      cancelLabel={noButtonLabel ?? t("no")}
      isConfirmDisabled={confirmDisabled}
      confirmTestId={CONFIRM_DIALOG_YES_BUTTON_TEST_ID}
      cancelTestId={CONFIRM_DIALOG_NO_BUTTON_TEST_ID}
      onConfirm={onConfirm}
    />
  )
}

export default React.memo(ConfirmDialog)
