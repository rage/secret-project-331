"use client"

import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
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
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (!disabled && secondsLeft <= 0) {
      setOpen(true)
    }
  }, [disabled, secondsLeft])

  const handleClose = async () => {
    setOpen(false)
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
