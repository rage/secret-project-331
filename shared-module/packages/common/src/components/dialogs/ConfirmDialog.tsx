import React from "react"

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
}) => (
  <StandardDialog
    open={open}
    onClose={onCancel}
    title={title}
    buttons={[
      // eslint-disable-next-line i18next/no-literal-string
      { children: "Cancel", variant: "secondary", onClick: onCancel },
      // eslint-disable-next-line i18next/no-literal-string
      { children: "OK", variant: "primary", onClick: onConfirm },
    ]}
  >
    {message}
  </StandardDialog>
)

export default React.memo(ConfirmDialog)
