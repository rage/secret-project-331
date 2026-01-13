"use client"
import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import StandardDialog from "./StandardDialog"
import {
  DIALOG_PROVIDER_DIALOG_TEST_ID,
  PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID,
  PROMPT_DIALOG_INPUT_TEST_ID,
  PROMPT_DIALOG_OK_BUTTON_TEST_ID,
} from "./dialogTestIds"

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
  const { t } = useTranslation()
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
      data-testid={DIALOG_PROVIDER_DIALOG_TEST_ID}
      open={open}
      onClose={onCancel}
      title={title}
      buttons={[
        {
          children: t("button-cancel"),
          variant: "secondary",
          onClick: onCancel,
          "data-testid": PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID,
        },
        {
          children: t("button-ok"),
          variant: "primary",
          onClick: () => onConfirm(value),
          "data-testid": PROMPT_DIALOG_OK_BUTTON_TEST_ID,
        },
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
          data-testid={PROMPT_DIALOG_INPUT_TEST_ID}
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
