"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { LinkingEmailStatus } from "@/generated/api/types.generated"

export interface LinkingEmailLineProps {
  linkingEmail: LinkingEmailStatus | null | undefined
}

const lineCss = css`
  margin: 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-1);
`

/**
 * The one line a student is told about the linking mail, and only where they are blocked on opening
 * it. `queued` and `retrying` render nothing: a line about a mail that is a minute away buys a
 * support ticket and nothing else.
 *
 * Never claims delivery. We hand the message to a relay and cannot see an inbox.
 */
const LinkingEmailLine: React.FC<LinkingEmailLineProps> = ({ linkingEmail }) => {
  const { t, i18n } = useTranslation()
  if (!linkingEmail) {
    return null
  }
  if (linkingEmail.email_send_status === "send_failed") {
    return <p className={lineCss}>{t("credit-registration-linking-email-send-failed")}</p>
  }
  if (linkingEmail.email_send_status !== "sent" || !linkingEmail.sent_at) {
    return null
  }
  return (
    <p className={lineCss}>
      {t("credit-registration-linking-email-sent", {
        email: linkingEmail.emailed_to_masked,
        date: new Date(linkingEmail.sent_at).toLocaleDateString(i18n.language),
      })}
    </p>
  )
}

export default LinkingEmailLine
