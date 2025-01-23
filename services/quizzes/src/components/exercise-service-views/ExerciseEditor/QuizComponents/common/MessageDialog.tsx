import { css } from "@emotion/css"
import React from "react"

import StandardDialog from "@/shared-module/common/components/StandardDialog"

interface MessageDialogProps {
  title: string
  description: string
  open: boolean
  onClose?: () => void
}

const MessageDialog: React.FC<MessageDialogProps> = ({ title, description, open, onClose }) => {
  return (
    <StandardDialog open={open} onClose={onClose} title={title}>
      <div
        className={css`
          color: #535a66;
          padding: 16px 0;
        `}
      >
        {description}
      </div>
    </StandardDialog>
  )
}

export default MessageDialog
