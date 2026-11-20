"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { Dialog } from "@/shared-module/components"

export interface ExamTimeOverModalProps {
  disabled: boolean
  onClose: () => Promise<void>
  secondsLeft: number
}

const ExamTimeOverModal: React.FC<React.PropsWithChildren<ExamTimeOverModalProps>> = ({
  disabled,
  onClose,
  secondsLeft,
}) => {
  const [dismissed, setDismissed] = useState(false)
  const { t } = useTranslation()
  const open = !disabled && secondsLeft <= 0 && !dismissed

  // Dismissal is permanent: secondsLeft keeps changing while the time is over.
  const handleClose = async () => {
    setDismissed(true)
    await onClose()
  }

  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={handleClose} aria-label={t("exam-timer-has-run-out")}>
      <div
        className={css`
          margin: 1rem;
        `}
      >
        <p>{t("exam-timer-has-run-out")}</p>
      </div>
    </Dialog>
  )
}

export default ExamTimeOverModal
