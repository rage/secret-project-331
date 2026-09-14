"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationNotificationKind,
  EmailSendStatus,
  LinkingEmailStatus,
  NotificationEmailStatus,
} from "@/generated/api/types.generated"
import { humanReadableDate } from "@/shared-module/common/utils/time"

import { labelFrom } from "./labelFrom"

const lineCss = css`
  margin: 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-1);
`

interface EmailStatusLineProps {
  status: { email_send_status: EmailSendStatus; sent_at?: string | null } | null | undefined
  kind: string
  sentKeys: Record<string, string>
  sentFallbackKey: string
  sendFailedKeys: Record<string, string>
  sendFailedFallbackKey: string
  sentOptions?: Record<string, unknown> | undefined
}

/** Says nothing while the mail is queued or retrying, and never that it was delivered. */
const EmailStatusLine: React.FC<EmailStatusLineProps> = ({
  status,
  kind,
  sentKeys,
  sentFallbackKey,
  sendFailedKeys,
  sendFailedFallbackKey,
  sentOptions,
}) => {
  const { t, i18n } = useTranslation()
  if (!status) {
    return null
  }
  if (status.email_send_status === "send_failed") {
    return <p className={lineCss}>{labelFrom(t, sendFailedKeys, kind, sendFailedFallbackKey)}</p>
  }
  if (status.email_send_status !== "sent" || !status.sent_at) {
    return null
  }
  return (
    <p className={lineCss}>
      {labelFrom(t, sentKeys, kind, sentFallbackKey, {
        ...sentOptions,
        date: humanReadableDate(status.sent_at, i18n.language),
      })}
    </p>
  )
}

// oxlint-disable-next-line i18next/no-literal-string
const LINKING_KIND = "linking"
const LINKING_SENT_KEYS = { [LINKING_KIND]: "credit-registration-linking-email-sent" }
const LINKING_SEND_FAILED_KEYS = { [LINKING_KIND]: "credit-registration-linking-email-send-failed" }

export interface LinkingEmailLineProps {
  linkingEmail: LinkingEmailStatus | null | undefined
}

export const LinkingEmailLine: React.FC<LinkingEmailLineProps> = ({ linkingEmail }) => (
  <EmailStatusLine
    status={linkingEmail}
    kind={LINKING_KIND}
    sentKeys={LINKING_SENT_KEYS}
    sentFallbackKey={LINKING_SENT_KEYS[LINKING_KIND]}
    sendFailedKeys={LINKING_SEND_FAILED_KEYS}
    sendFailedFallbackKey={LINKING_SEND_FAILED_KEYS[LINKING_KIND]}
    sentOptions={linkingEmail ? { email: linkingEmail.emailed_to_masked } : undefined}
  />
)

// oxlint-disable-next-line i18next/no-literal-string
const ACTION_NEEDED_KIND = "action_needed"
// oxlint-disable-next-line i18next/no-literal-string
const REGISTERED_KIND = "registered"

// `satisfies` keeps this exhaustive over the kind enum, so a new backend variant fails the build
// here instead of silently telling a student their credits were registered.
const NOTIFICATION_SENT_KEYS = {
  [ACTION_NEEDED_KIND]: "credit-registration-action-needed-email-sent",
  [REGISTERED_KIND]: "credit-registration-registered-email-sent",
} satisfies Record<CreditRegistrationNotificationKind, string>

const NOTIFICATION_SEND_FAILED_KEYS = {
  [ACTION_NEEDED_KIND]: "credit-registration-action-needed-email-send-failed",
  [REGISTERED_KIND]: "credit-registration-registered-email-send-failed",
} satisfies Record<CreditRegistrationNotificationKind, string>

// A kind outside the known enum (an old client against a newer backend) falls back to the
// action-needed copy, never the registered one, so it can't misreport credits as registered.
const UNKNOWN_KIND_SENT_FALLBACK = NOTIFICATION_SENT_KEYS[ACTION_NEEDED_KIND]
const UNKNOWN_KIND_SEND_FAILED_FALLBACK = NOTIFICATION_SEND_FAILED_KEYS[ACTION_NEEDED_KIND]

export interface NotificationEmailLineProps {
  notificationEmail: NotificationEmailStatus | null | undefined
}

export const NotificationEmailLine: React.FC<NotificationEmailLineProps> = ({
  notificationEmail,
}) => (
  <EmailStatusLine
    status={notificationEmail}
    kind={notificationEmail?.kind ?? ACTION_NEEDED_KIND}
    sentKeys={NOTIFICATION_SENT_KEYS}
    sentFallbackKey={UNKNOWN_KIND_SENT_FALLBACK}
    sendFailedKeys={NOTIFICATION_SEND_FAILED_KEYS}
    sendFailedFallbackKey={UNKNOWN_KIND_SEND_FAILED_FALLBACK}
  />
)
