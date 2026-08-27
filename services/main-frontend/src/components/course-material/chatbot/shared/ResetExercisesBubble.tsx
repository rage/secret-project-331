"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { ClientToolBubbleProps } from "./clientToolRegistry"
import ConfirmActionBubble from "./ConfirmActionBubble"
import { RESET_EXERCISES_TOOL } from "./resetExercisesCalls"
import type { ResetExercisesCall } from "./resetExercisesCalls"

type ResetExercisesBubbleProps = ClientToolBubbleProps<ResetExercisesCall>

const rowStyle = css`
  margin: 0 0 0.4rem;
`

const emphasisRowStyle = css`
  margin: 0 0 0.4rem;
  font-weight: 700;
`

/** A confirm bubble for `reset_exercises`, a destructive action styled accordingly (`danger`). */
const ResetExercisesBubble: React.FC<ResetExercisesBubbleProps> = ({ call, ...rest }) => {
  const { t } = useTranslation()

  const exercisesRow =
    call.exerciseNames.length > 0 ? (
      <p className={rowStyle}>
        {t("chatbot-reset-exercises-exercises-row", { names: call.exerciseNames.join(", ") })}
      </p>
    ) : (
      <p className={emphasisRowStyle}>{t("chatbot-reset-exercises-all-exercises-row")}</p>
    )

  const rows = (
    <>
      <p className={rowStyle}>{t("chatbot-reset-exercises-user-row", { email: call.userEmail })}</p>
      <p className={rowStyle}>
        {t("chatbot-reset-exercises-course-row", { courseName: call.courseName })}
      </p>
      <p className={rowStyle}>{t("chatbot-reset-exercises-reason-row", { reason: call.reason })}</p>
      {exercisesRow}
      <p className={rowStyle}>{t("chatbot-reset-exercises-consequence")}</p>
    </>
  )

  return (
    <ConfirmActionBubble
      {...rest}
      call={call}
      toolName={RESET_EXERCISES_TOOL}
      title={t("chatbot-reset-exercises-title")}
      rows={rows}
      danger={true}
      confirmLabel={t("chatbot-reset-exercises-confirm-label")}
      executedContent={<p className={rowStyle}>{t("chatbot-reset-exercises-executed-detail")}</p>}
    />
  )
}

export default ResetExercisesBubble
