"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { AdminManualLinkingEmailSend } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { sentenceWithEmailAddress } from "../EmailAddress"
import { noteCss, stackedCellCss } from "../styles"
import { formatZonedTimestamp } from "../ZonedTimestamp"

const SENTENCES = {
  candidate: {
    withAddress: "credit-registration-admin-linking-candidate-sent-by-hand",
    withoutAddress: "credit-registration-admin-linking-candidate-sent-by-hand-no-address",
  },
  registration: {
    withAddress: "credit-registration-admin-linking-email-sent-by-hand",
    withoutAddress: "credit-registration-admin-linking-email-sent-by-hand-no-address",
  },
} as const

interface Props {
  sends: AdminManualLinkingEmailSend[]
  /** `candidate` under a person in a send dialog; `registration` elsewhere, naming the email. */
  variant: keyof typeof SENTENCES
}

/** Who sent linking emails by hand, to where and when, one line each. */
const ManualLinkingEmailSendLines: React.FC<Props> = ({ sends, variant }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (sends.length === 0) {
    return null
  }
  const sentences = SENTENCES[variant]
  return (
    <span className={stackedCellCss}>
      {sends.map((send) => {
        const values = {
          name:
            formatUserName({
              first_name: send.sent_by_first_name,
              last_name: send.sent_by_last_name,
            }) ||
            send.sent_by_email ||
            t("missing-name"),
          time: formatZonedTimestamp(new Date(send.sent_at)),
        }
        return (
          <span key={`${send.sent_at}-${send.sent_by_user_id}`} className={noteCss}>
            {send.emailed_to
              ? sentenceWithEmailAddress(t, sentences.withAddress, send.emailed_to, values)
              : t(sentences.withoutAddress, values)}
          </span>
        )
      })}
    </span>
  )
}

export default ManualLinkingEmailSendLines
