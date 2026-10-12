"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { EmailAddress } from "@/components/credit-registration/EmailAddress"
import type {
  AdminLinkingCandidate,
  AdminResendAccountLinkingEmailResult,
} from "@/generated/api/types.generated"
import { normalizeErrorForDisplay } from "@/shared-module/common/errors/normalizeErrorForDisplay"
import { Infobox } from "@/shared-module/components"

import type { CreditRegistrationTFunction } from "../constants"
import { CREDIT_REGISTRATION_NS, TONE } from "../constants"
import { RESEND_QUEUED } from "../resendOutcome"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { resendOutcomeLabel } from "./adminCreditRegistrationCopy"

export const candidateListCss = css`
  max-height: 24rem;
  overflow-y: auto;
`

/** First and last name joined; empty when there are neither. */
export const candidateFullName = (candidate: {
  first_names?: string | null
  last_name?: string | null
}): string => [candidate.first_names, candidate.last_name].filter(Boolean).join(" ")

/** A person on an enrolment list by name, or a placeholder when Sisu gave none. */
export const candidateName = (t: CreditRegistrationTFunction, candidate: AdminLinkingCandidate) =>
  candidateFullName(candidate) || t("credit-registration-admin-linking-candidate-no-name")

/** Whether any listed person has had a linking email, so saying "not emailed" tells them apart. */
export const showsNotEmailed = (candidates: AdminLinkingCandidate[]): boolean =>
  candidates.some(
    (candidate) => candidate.linking_emails_for_course > 0 || candidate.manual_sends.length > 0,
  )

/** What tells a listed person apart, for `InlineParts`: address, enrolment time, emails so far. */
export const candidateFacts = (
  t: CreditRegistrationTFunction,
  candidate: AdminLinkingCandidate,
  isNotEmailedShown: boolean,
) => [
  candidate.email ? (
    <EmailAddress key="email" address={candidate.email} />
  ) : (
    t("credit-registration-admin-linking-candidate-no-address")
  ),
  candidate.enrolled_at
    ? t("credit-registration-admin-linking-candidate-enrolled", {
        time: formatZonedTimestamp(new Date(candidate.enrolled_at)),
      })
    : t("credit-registration-admin-linking-candidate-enrolment-time-unknown"),
  candidate.linking_emails_for_course > 0
    ? t("credit-registration-admin-linking-candidate-emails", {
        count: candidate.linking_emails_for_course,
      })
    : isNotEmailedShown &&
      candidate.manual_sends.length === 0 &&
      t("credit-registration-admin-linking-candidate-not-emailed"),
]

/** `candidate` as `result` left them, when they are the one `studentNumber` names. */
export const withSendResult = (
  candidate: AdminLinkingCandidate,
  studentNumber: string,
  result: AdminResendAccountLinkingEmailResult,
): AdminLinkingCandidate =>
  candidate.student_number === studentNumber && result.manual_send
    ? {
        ...candidate,
        linking_emails_for_course: result.mails_sent_for_this_course,
        manual_sends: [result.manual_send, ...candidate.manual_sends],
      }
    : candidate

/** What a linking email send did, with where the person's emails for the course now stand. */
export const ResendOutcomeNotice: React.FC<{
  result: AdminResendAccountLinkingEmailResult
  children?: React.ReactNode
}> = ({ result, children }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <Infobox tone={result.outcome === RESEND_QUEUED ? TONE.INFO : TONE.WARNING}>
      <div>{resendOutcomeLabel(t, result.outcome)}</div>
      <div>
        {t("credit-registration-resend-mails-so-far", {
          sent: result.mails_sent_for_this_course,
          max: result.max_mails_per_person_and_course,
        })}
      </div>
      {result.retired_mail_count > 0 && (
        <div>
          {t("credit-registration-admin-resend-retired-mails", {
            count: result.retired_mail_count,
          })}
        </div>
      )}
      {children}
    </Infobox>
  )
}

/** A send request that failed, in the server's words when it refused it with a reason. */
const SendFailedNotice: React.FC<{ error: unknown }> = ({ error }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { t: tShared } = useTranslation()
  const view = normalizeErrorForDisplay(error, tShared)
  // A server error's message is a generic "Internal server error".
  const message = view.category === "server" ? null : view.message
  return (
    <Infobox tone={TONE.DANGER} announce>
      {message || t("credit-registration-admin-send-linking-email-send-failed")}
    </Infobox>
  )
}

/** The last send's outcome, or why it failed; nothing while a send is under way. */
export const SendNotice: React.FC<{
  result: AdminResendAccountLinkingEmailResult | null
  mutation: { isPending: boolean; isError: boolean; error: unknown }
}> = ({ result, mutation }) => {
  if (mutation.isPending) {
    return null
  }
  if (mutation.isError) {
    return <SendFailedNotice error={mutation.error} />
  }
  return result && <ResendOutcomeNotice result={result} />
}
