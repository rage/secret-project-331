import React from "react"

import StandardDialog from "./StandardDialog"

export interface AlertDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  onClose: () => void
}

const AlertDialog: React.FC<AlertDialogProps> = ({ open, title, message, onClose }) => (
  <StandardDialog
    open={open}
    onClose={onClose}
    title={title}
    // eslint-disable-next-line i18next/no-literal-string
    buttons={[{ children: "OK", variant: "primary", onClick: onClose }]}
  >
    {message}
  </StandardDialog>
)

export default React.memo(AlertDialog)
