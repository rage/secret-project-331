import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"

import StandardDialog from "./StandardDialog"

export interface PromptDialogProps {
  open: boolean
  title: string
  message?: React.ReactNode
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  title,
  message,
  defaultValue = "",
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      inputRef.current?.focus()
    }
  }, [open, defaultValue])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onConfirm(value)
    }
  }

  return (
    <StandardDialog
      open={open}
      onClose={onCancel}
      title={title}
      buttons={[
        // eslint-disable-next-line i18next/no-literal-string
        { children: "Cancel", variant: "secondary", onClick: onCancel },
        // eslint-disable-next-line i18next/no-literal-string
        { children: "OK", variant: "primary", onClick: () => onConfirm(value) },
      ]}
    >
      <div>
        {message && <div>{message}</div>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={css`
            width: 100%;
            padding: 0.5rem;
            margin-top: 1rem;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 4px;
          `}
        />
      </div>
    </StandardDialog>
  )
}

export default React.memo(PromptDialog)
