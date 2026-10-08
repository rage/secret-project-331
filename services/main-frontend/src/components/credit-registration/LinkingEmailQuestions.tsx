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
import { studentNumberLinkBand } from "./trackerView"
import { useIsAccountLinkingEnabled } from "./useIsAccountLinkingEnabled"

const SUPPORT_LINK_IN_TEXT = "link"

export interface LinkingEmailQuestionsProps {
  registration: MyCreditRegistration
  verifiedNumber: MyVerifiedStudentNumber | null
  enrolmentRoute: MyEnrolmentRoute | null
}

/** Questions a student waiting for the account linking email asks, while one is still to come. */
export const LinkingEmailQuestions: React.FC<LinkingEmailQuestionsProps> = ({
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
  if (
    band?.kind !== "awaiting-enrolment" &&
    band?.kind !== "awaiting-email" &&
    band?.kind !== "mailed" &&
    band?.kind !== "link-expired"
  ) {
    return null
  }
  const supportMail = missingLinkingEmailSupportMail(t, registration.course_name)

  return (
    <div className={subsectionCss}>
      <Disclosure title={t("credit-registration-faq-no-email-question")}>
        <div className={subsectionCss}>
          <p>{t("credit-registration-faq-no-email-answer")}</p>
          <p>
            {t("credit-registration-faq-no-email-contact")}{" "}
            <SupportMailLink
              appearance={SUPPORT_LINK_IN_TEXT}
              label={SUPPORT_EMAIL}
              subject={supportMail.subject}
              bodyLines={supportMail.bodyLines}
            />
          </p>
        </div>
      </Disclosure>
      <Disclosure title={t("credit-registration-faq-different-email-question")}>
        <p>{t("credit-registration-faq-different-email-answer")}</p>
      </Disclosure>
    </div>
  )
}
