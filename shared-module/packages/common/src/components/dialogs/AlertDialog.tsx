import React from "react"
import { useTranslation } from "react-i18next"

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
      open={open}
      onClose={onClose}
      title={title}
      buttons={[{ children: t("button-ok"), variant: "primary", onClick: onClose }]}
    >
      {message}
    </StandardDialog>
  )
}

export default React.memo(AlertDialog)
