import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../../shared-module/components/Button"
import { baseTheme } from "../../shared-module/styles"

export interface ExamInstructionsProps {
  onStart: () => Promise<void>
  canStartExam: boolean
  examHasStarted: boolean
  examHasEnded: boolean
  timeMinutes: number
}

const ExamStartBanner: React.FC<React.PropsWithChildren<ExamInstructionsProps>> = ({
  onStart,
  canStartExam,
  examHasStarted,
  examHasEnded,
  timeMinutes,
  children,
}) => {
  const [disabled, setDisabled] = useState(false)
  const { t } = useTranslation()

  const handleStart = async () => {
    if (window.confirm(t("exam-start-confirmation", { "time-minutes": timeMinutes }))) {
      setDisabled(false)
      await onStart()
      setDisabled(true)
    }
  }

  return (
    <div>
      {/* Once again, need to rethink in regards to contrast. */}
      <div
        className={css`
          background: ${baseTheme.colors.blue[500]};
          color: white;
          flex: 1;
          padding: 0.5rem;
          text-align: center;
          text-transform: uppercase;
        `}
      >
        {t("things-to-know-before-you-start")}
      </div>
      <div
        className={css`
          flex: 1;
          border-style: none solid solid;
          border-color: ${baseTheme.colors.blue[500]};
          padding: 2rem;
        `}
      >
        <div
          className={css`
            text-align: center;
          `}
        >
          <h2>{t("instructions")}</h2>
        </div>
        <p
          className={css`
            margin-bottom: 2rem;
          `}
        >
          {children}
        </p>
        {!canStartExam && <p>{t("you-are-not-eligible-for-taking-this-exam")}</p>}
        <div
          className={css`
            text-align: center;
          `}
        >
          <Button
            onClick={handleStart}
            disabled={!examHasStarted || examHasEnded || !canStartExam || disabled}
            variant="primary"
            size="medium"
          >
            {t("start-the-exam")}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ExamStartBanner
