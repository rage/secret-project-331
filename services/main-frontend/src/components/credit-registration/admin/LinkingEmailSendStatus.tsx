"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { EmailSendStatus, EmailSendStatusReport } from "@/generated/api/types.generated"
import { Badge } from "@/shared-module/components"

import { BADGE_COMPACT, CREDIT_REGISTRATION_NS, SEND_FAILED, TONE } from "../constants"
import { noteCss, stackedCellCss } from "../styles"
import { ZonedTimestamp } from "../ZonedTimestamp"
import { sendStatusLabel } from "./adminCreditRegistrationCopy"

const QUEUED: EmailSendStatus = "queued"

/**
 * Where one linking email stands on our side: queued by which process, sent, or failing.
 *
 * `report` is null until the `link-emails` phase queues the mail.
 */
const LinkingEmailSendStatus: React.FC<{ report: EmailSendStatusReport | null | undefined }> = ({
  report,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (!report) {
    return (
      <span className={noteCss}>
        {t("credit-registration-admin-send-status-waiting-for-link-emails")}
      </span>
    )
  }
  if (report.email_send_status === QUEUED) {
    return (
      <span className={noteCss}>
        {t("credit-registration-admin-send-status-waiting-for-email-worker")}
      </span>
    )
  }
  return (
    <span className={stackedCellCss}>
      {report.email_send_status === SEND_FAILED ? (
        <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
          {sendStatusLabel(t, report.email_send_status)}
        </Badge>
      ) : (
        <span>{sendStatusLabel(t, report.email_send_status)}</span>
      )}
      <ZonedTimestamp at={report.sent_at ?? report.last_attempt_at} />
    </span>
  )
}

export default LinkingEmailSendStatus
