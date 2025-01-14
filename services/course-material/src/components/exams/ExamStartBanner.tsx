import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ExamEnrollmentData } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import { baseTheme } from "@/shared-module/common/styles"

export interface ExamInstructionsProps {
  onStart: () => Promise<void>
  examHasStarted: boolean
  examHasEnded: boolean
  timeMinutes: number
  examEnrollmentData: ExamEnrollmentData
}

const ExamStartBanner: React.FC<React.PropsWithChildren<ExamInstructionsProps>> = ({
  onStart,
  examEnrollmentData,
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
      // If the instructions are long, a student might have scrolled down a lot. We'll scroll up so that the student sees the exam from the beginning.
      // eslint-disable-next-line i18next/no-literal-string
      window.scrollTo({ top: 0, behavior: "smooth" })
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
          <h2>{t("title-instructions")}</h2>
        </div>
        <p
          className={css`
            margin-bottom: 2rem;
          `}
        >
          {children}
        </p>
        {examEnrollmentData.tag === "NotEnrolled" && !examEnrollmentData.can_enroll && (
          <p>{t("message-you-have-not-met-the-requirements-for-taking-this-exam")}</p>
        )}
        {!examHasStarted && !examHasEnded && <p>{t("message-the-exam-has-not-started-yet")}</p>}
        <div
          className={css`
            text-align: center;
            margin-top: 1rem;
          `}
        >
          <Button
            onClick={handleStart}
            disabled={
              !examHasStarted ||
              examHasEnded ||
              (examEnrollmentData.tag === "NotEnrolled" && !examEnrollmentData.can_enroll) ||
              disabled
            }
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
