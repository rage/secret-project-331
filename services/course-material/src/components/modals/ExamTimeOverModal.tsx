import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"

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
    <Dialog open={open} onClose={handleClose}>
      <div
        className={css`
          margin: 1rem;
        `}
      >
        <p>{t("exam-timer-has-run-out")}</p>
        <div
          className={css`
            display: flex;
            justify-content: center;
          `}
        >
          <Button size="medium" variant="primary" onClick={handleClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default ExamTimeOverModal
