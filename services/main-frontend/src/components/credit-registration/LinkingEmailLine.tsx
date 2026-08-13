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

/** Says nothing while the mail is queued or retrying, and never that it was delivered. */
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
