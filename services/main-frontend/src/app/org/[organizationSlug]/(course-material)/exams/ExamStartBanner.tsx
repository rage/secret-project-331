"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ExamEnrollmentData } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
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
  const { confirm } = useDialog()

  const handleStart = async () => {
    if (await confirm(t("exam-start-confirmation", { "time-minutes": timeMinutes }))) {
      setDisabled(true)
      try {
        await onStart()
        // eslint-disable-next-line i18next/no-literal-string
        window.scrollTo({ top: 0, behavior: "smooth" })
      } catch {
        setDisabled(false)
      }
    }
  }

  return (
    <div
      className={css`
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        border: 1px solid ${baseTheme.colors.clear[300]};
      `}
    >
      <div
        className={css`
          background: linear-gradient(
            140deg,
            ${baseTheme.colors.blue[500]},
            ${baseTheme.colors.blue[600]}
          );
          color: white;
          flex: 1;
          padding: 0.75rem 1rem;
          text-align: center;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.02em;
        `}
      >
        {t("things-to-know-before-you-start")}
      </div>
      <div
        className={css`
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
            margin-top: 1.5rem;
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
            size="large"
          >
            {t("start-the-exam")}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ExamStartBanner
