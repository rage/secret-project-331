"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type {
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
} from "@/generated/api/types.generated"
import { Disclosure } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, SUPPORT_EMAIL } from "./constants"
import { missingLinkingEmailSupportMail } from "./studentSupportMail"
import { subsectionCss } from "./styles"
import SupportMailLink from "./SupportMailLink"
import { asksWhereYouEnrolled, studentNumberLinkBand } from "./trackerView"
import { useIsAccountLinkingEnabled } from "./useIsAccountLinkingEnabled"

const SUPPORT_LINK_IN_TEXT = "link"

/** The link bands under which a linking email is still to come or still to be opened. */
const AWAITING_LINKING_EMAIL = ["awaiting-enrolment", "awaiting-email", "mailed", "link-expired"]

export interface RegistrationQuestionsProps {
  registration: MyCreditRegistration
  verifiedNumber: MyVerifiedStudentNumber | null
  enrolmentRoute: MyEnrolmentRoute | null
}

/** Questions a student asks while enrolling or waiting for the account linking email. */
export const RegistrationQuestions: React.FC<RegistrationQuestionsProps> = ({
  registration,
  verifiedNumber,
  enrolmentRoute,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const band = studentNumberLinkBand(registration, verifiedNumber, {
    isAccountLinkingEnabled,
    enrolmentRoute,
  })
  const isEnrolling = asksWhereYouEnrolled({ registration, enrolmentRoute })
  const isAwaitingLinkingEmail = band !== null && AWAITING_LINKING_EMAIL.includes(band.kind)
  if (!isEnrolling && !isAwaitingLinkingEmail) {
    return null
  }
  const supportMail = missingLinkingEmailSupportMail(t, registration.course_name)

  return (
    <div className={subsectionCss}>
      {isEnrolling && enrolmentRoute?.enrolment_confirmed_at ? (
        <Disclosure title={t("credit-registration-faq-how-to-enrol-question")}>
          <p>{t("credit-registration-faq-how-to-enrol-answer")}</p>
        </Disclosure>
      ) : null}
      {isEnrolling ? (
        <Disclosure title={t("credit-registration-faq-enrolment-not-noticed-question")}>
          <p>{t("credit-registration-faq-enrolment-not-noticed-answer")}</p>
        </Disclosure>
      ) : null}
      {isAwaitingLinkingEmail ? (
        <>
          <Disclosure title={t("credit-registration-faq-linking-email-address-question")}>
            <p>
              {t("credit-registration-faq-linking-email-address-answer")}{" "}
              <SupportMailLink
                appearance={SUPPORT_LINK_IN_TEXT}
                label={SUPPORT_EMAIL}
                subject={supportMail.subject}
                bodyLines={supportMail.bodyLines}
              />
            </p>
          </Disclosure>
          <Disclosure title={t("credit-registration-faq-different-email-question")}>
            <p>{t("credit-registration-faq-different-email-answer")}</p>
          </Disclosure>
        </>
      ) : null}
      <Disclosure title={t("credit-registration-faq-credits-in-sisu-question")}>
        <p>{t("credit-registration-faq-credits-in-sisu-answer")}</p>
      </Disclosure>
    </div>
  )
}
