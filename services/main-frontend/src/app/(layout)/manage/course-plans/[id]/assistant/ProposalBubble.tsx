"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import type { ClientToolBubbleProps } from "@/components/course-material/chatbot/shared/clientToolRegistry"
import ConfirmActionBubble from "@/components/course-material/chatbot/shared/ConfirmActionBubble"
import type {
  ClientToolAnswer,
  ClientToolName,
} from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { getErrorMessage } from "@/shared-module/components"

import { usePendingSaves } from "../components/PendingSavesContext"

const noticeStyle = css`
  margin: 0 0 0.75rem;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid ${baseTheme.colors.red[600]};
  background: ${baseTheme.colors.red[100]};
  color: ${baseTheme.colors.red[700]};
  font-size: 0.9rem;
`

const noticeTextStyle = css`
  margin: 0;
`

const noticeDetailStyle = css`
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[600]};
`

const confirmationSchema = z.object({
  type: z.literal("Data"),
  data: z.object({ result: z.object({ confirmed: z.literal(true) }) }),
})

export interface ProposalBubbleProps<TCall> extends ClientToolBubbleProps<TCall> {
  toolName: ClientToolName
  title: string
  rows: React.ReactNode
}

/**
 * A change the course design assistant proposes to the plan, applied or discarded by the user.
 * Saves the plan pages' unsaved form edits before applying, and shows on the card why applying
 * failed.
 */
const ProposalBubble = <TCall,>({
  answerError,
  onAnswer,
  isTurnInFlight,
  ...rest
}: ProposalBubbleProps<TCall>): React.ReactElement => {
  const { t } = useTranslation()
  const pendingSaves = usePendingSaves()
  const [isSavingEdits, setIsSavingEdits] = useState(false)
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false)

  const handleAnswer = async (
    toolCallId: string,
    toolName: ClientToolName,
    answer: ClientToolAnswer,
  ) => {
    if (confirmationSchema.safeParse(answer).success && pendingSaves) {
      setIsSavingEdits(true)
      const isAllSaved = await pendingSaves.saveAll().finally(() => setIsSavingEdits(false))
      setHasUnsavedEdits(!isAllSaved)
      if (!isAllSaved) {
        return
      }
    }
    onAnswer(toolCallId, toolName, answer)
  }

  let notice: React.ReactNode = null
  if (hasUnsavedEdits) {
    notice = (
      <div className={noticeStyle} role="alert">
        <p className={noticeTextStyle}>{t("course-plans-assistant-unsaved-edits")}</p>
      </div>
    )
  } else if (answerError !== undefined) {
    notice = (
      <div className={noticeStyle} role="alert">
        <p className={noticeTextStyle}>{t("course-plans-assistant-apply-failed")}</p>
        <p className={noticeDetailStyle}>{getErrorMessage(answerError)}</p>
      </div>
    )
  }

  return (
    <ConfirmActionBubble
      {...rest}
      isTurnInFlight={isTurnInFlight || isSavingEdits}
      onAnswer={(toolCallId, toolName, answer) => void handleAnswer(toolCallId, toolName, answer)}
      danger={false}
      confirmLabel={t("course-plans-assistant-apply")}
      declineLabel={t("course-plans-assistant-discard")}
      notice={notice}
    />
  )
}

export default ProposalBubble
