import React from "react"
import { useTranslation } from "react-i18next"

import StandardDialog from "./StandardDialog"

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation()
  return (
    <StandardDialog
      open={open}
      onClose={onCancel}
      title={title}
      closeOnClickOutside={false}
      buttons={[
        { children: t("no"), variant: "secondary", onClick: onCancel },
        { children: t("yes"), variant: "primary", onClick: onConfirm },
      ]}
    >
      {message}
    </StandardDialog>
  )
}

export default React.memo(ConfirmDialog)
