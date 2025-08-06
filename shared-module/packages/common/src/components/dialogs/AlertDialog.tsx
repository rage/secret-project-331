import React from "react"
import { useTranslation } from "react-i18next"

import { ALERT_DIALOG_OK_BUTTON_TEST_ID, DIALOG_PROVIDER_DIALOG_TEST_ID } from "./DialogProvider"
import StandardDialog from "./StandardDialog"

export interface AlertDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  onClose: () => void
}

const AlertDialog: React.FC<AlertDialogProps> = ({ open, title, message, onClose }) => {
  const { t } = useTranslation()
  return (
    <StandardDialog
      data-testid={DIALOG_PROVIDER_DIALOG_TEST_ID}
      open={open}
      onClose={onClose}
      title={title}
      buttons={[
        {
          children: t("button-ok"),
          variant: "primary",
          onClick: onClose,
          "data-testid": ALERT_DIALOG_OK_BUTTON_TEST_ID,
        },
      ]}
    >
      {message}
    </StandardDialog>
  )
}

export default React.memo(AlertDialog)
