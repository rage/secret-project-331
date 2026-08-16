"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { NotificationEmailStatus } from "@/generated/api/types.generated"

import { labelFrom } from "./labelFrom"

export interface NotificationEmailLineProps {
  notificationEmail: NotificationEmailStatus | null | undefined
}

const lineCss = css`
  margin: 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-1);
`

const SENT_KEYS = {
  action_needed: "credit-registration-action-needed-email-sent",
  registered: "credit-registration-registered-email-sent",
} as const

const SEND_FAILED_KEYS = {
  action_needed: "credit-registration-action-needed-email-send-failed",
  registered: "credit-registration-registered-email-send-failed",
} as const

/** Says nothing while the mail is queued or retrying, and never that it was delivered. */
const NotificationEmailLine: React.FC<NotificationEmailLineProps> = ({ notificationEmail }) => {
  const { t, i18n } = useTranslation()
  if (!notificationEmail) {
    return null
  }
  if (notificationEmail.email_send_status === "send_failed") {
    return (
      <p className={lineCss}>
        {labelFrom(t, SEND_FAILED_KEYS, notificationEmail.kind, SEND_FAILED_KEYS.registered)}
      </p>
    )
  }
  if (notificationEmail.email_send_status !== "sent" || !notificationEmail.sent_at) {
    return null
  }
  return (
    <p className={lineCss}>
      {labelFrom(t, SENT_KEYS, notificationEmail.kind, SENT_KEYS.registered, {
        date: new Date(notificationEmail.sent_at).toLocaleDateString(i18n.language),
      })}
    </p>
  )
}

export default NotificationEmailLine
