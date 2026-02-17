"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import {
  ConfirmButtons,
  ConfirmDialog,
  ConfirmMessage,
  ConfirmOverlay,
  ResetButton,
} from "../styles"

interface ResetConfirmDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export const ResetConfirmDialog: React.FC<ResetConfirmDialogProps> = (p) => {
  const { t } = useTranslation()
  if (!p.open) {
    return null
  }
  return (
    /* eslint-disable-next-line i18next/no-literal-string -- aria attribute */
    <ConfirmOverlay onClick={p.onCancel} role="dialog" aria-modal="true">
      <ConfirmDialog onClick={(e) => e.stopPropagation()}>
        <ConfirmMessage>{t("are-you-sure")}</ConfirmMessage>
        <ConfirmButtons>
          <ResetButton type="button" onClick={p.onCancel}>
            {t("button.cancel", "Cancel")}
          </ResetButton>
          <ResetButton type="button" onClick={p.onConfirm} data-cy="reset-btn-ok">
            {t("button.ok", "OK")}
          </ResetButton>
        </ConfirmButtons>
      </ConfirmDialog>
    </ConfirmOverlay>
  )
}
