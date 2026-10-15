"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { ClientToolBubbleProps } from "./clientToolRegistry"
import ConfirmActionBubble from "./ConfirmActionBubble"
import { UPDATE_CHEATING_STATUS_TOOL } from "./updateCheatingStatusCalls"
import type { UpdateCheatingStatusCall } from "./updateCheatingStatusCalls"

type UpdateCheatingStatusBubbleProps = ClientToolBubbleProps<UpdateCheatingStatusCall>

/**
 * A confirm-or-dismiss decision on a flagged suspected-cheating case, suspended for admin
 * confirmation before the server applies it. Never phrases the consequence as "cheating" in a way
 * a student-facing surface could ever render: this bubble only renders on the admin-only command
 * center, gated the same way the tool itself is.
 */
const UpdateCheatingStatusBubble: React.FC<UpdateCheatingStatusBubbleProps> = ({
  call,
  ...rest
}) => {
  const { t } = useTranslation()
  const isConfirm = call.decision === "confirm"

  const title = isConfirm
    ? t("chatbot-update-cheating-status-confirm-title")
    : t("chatbot-update-cheating-status-dismiss-title")
  const confirmLabel = isConfirm
    ? t("chatbot-update-cheating-status-confirm-label")
    : t("chatbot-update-cheating-status-dismiss-label")
  const consequence = isConfirm
    ? t("chatbot-update-cheating-status-confirm-consequence")
    : t("chatbot-update-cheating-status-dismiss-consequence")

  const rows = (
    <>
      <p>{t("chatbot-update-cheating-status-user-row", { email: call.userEmail })}</p>
      <p>{t("chatbot-update-cheating-status-course-row", { courseName: call.courseName })}</p>
      <p>{consequence}</p>
    </>
  )

  return (
    <ConfirmActionBubble
      {...rest}
      call={call}
      toolName={UPDATE_CHEATING_STATUS_TOOL}
      title={title}
      rows={rows}
      danger={true}
      confirmLabel={confirmLabel}
    />
  )
}

export default UpdateCheatingStatusBubble
