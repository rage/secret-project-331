"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationNotificationKind,
  EmailSendStatus,
  LinkingEmailStatus,
  NotificationEmailStatus,
} from "@/generated/api/types.generated"
import { humanReadableDate } from "@/shared-module/common/utils/time"

import { CREDIT_REGISTRATION_NS } from "./constants"
import { translateKey, widenedLookup } from "./labelFrom"
import { noteCss } from "./styles"

interface EmailStatusLineProps {
  status: { email_send_status: EmailSendStatus; sent_at?: string | null } | null | undefined
  sentText: (date: string) => string
  sendFailedText: string
}

/** Says nothing while the mail is queued or retrying, and never that it was delivered. */
const EmailStatusLine: React.FC<EmailStatusLineProps> = ({ status, sentText, sendFailedText }) => {
  const { i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  if (!status) {
    return null
  }
  if (status.email_send_status === "send_failed") {
    return <p className={noteCss}>{sendFailedText}</p>
  }
  if (status.email_send_status !== "sent" || !status.sent_at) {
    return null
  }
  return (
    <p className={noteCss}>{sentText(humanReadableDate(status.sent_at, i18n.language) ?? "")}</p>
  )
}

export interface LinkingEmailLineProps {
  linkingEmail: LinkingEmailStatus | null | undefined
}

/**
 * The confirmation link's send record, once one actually went out.
 *
 * For copy that names the mailbox and date inline instead of trailing `LinkingEmailLine` after it.
 * Null while queued or failed — use `LinkingEmailLine` for those instead, which say what happened.
 */
export const sentLinkingEmail = (
  linkingEmail: LinkingEmailStatus | null | undefined,
): { emailMasked: string; sentAt: string } | null =>
  linkingEmail?.email_send_status === "sent" && linkingEmail.sent_at
    ? { emailMasked: linkingEmail.emailed_to_masked, sentAt: linkingEmail.sent_at }
    : null

export const LinkingEmailLine: React.FC<LinkingEmailLineProps> = ({ linkingEmail }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <EmailStatusLine
      status={linkingEmail}
      sentText={(date) =>
        t("credit-registration-linking-email-sent", {
          email: linkingEmail?.emailed_to_masked,
          date,
        })
      }
      sendFailedText={t("credit-registration-linking-email-send-failed")}
    />
  )
}

const ACTION_NEEDED_KIND = "action_needed"
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

export interface NotificationEmailLineProps {
  notificationEmail: NotificationEmailStatus | null | undefined
}

export const NotificationEmailLine: React.FC<NotificationEmailLineProps> = ({
  notificationEmail,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const kind = notificationEmail?.kind ?? ACTION_NEEDED_KIND
  // A kind outside the known enum (an old client against a newer backend) falls back to the
  // action-needed copy, never the registered one, so it can't misreport credits as registered.
  const sentKey =
    widenedLookup(NOTIFICATION_SENT_KEYS, kind) ?? NOTIFICATION_SENT_KEYS[ACTION_NEEDED_KIND]
  const sendFailedKey =
    widenedLookup(NOTIFICATION_SEND_FAILED_KEYS, kind) ??
    NOTIFICATION_SEND_FAILED_KEYS[ACTION_NEEDED_KIND]
  return (
    <EmailStatusLine
      status={notificationEmail}
      sentText={() => translateKey(t, sentKey)}
      sendFailedText={translateKey(t, sendFailedKey)}
    />
  )
}
