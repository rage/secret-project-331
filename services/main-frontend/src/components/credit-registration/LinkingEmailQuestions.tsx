"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { MyCreditRegistration, MyVerifiedStudentNumber } from "@/generated/api/types.generated"
import { Disclosure } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, SUPPORT_EMAIL } from "./constants"
import { subsectionCss } from "./styles"
import SupportMailLink from "./SupportMailLink"
import { studentNumberLinkBand } from "./trackerView"
import { useIsAccountLinkingEnabled } from "./useIsAccountLinkingEnabled"

const SUPPORT_LINK_IN_TEXT = "link"

export interface LinkingEmailQuestionsProps {
  registration: MyCreditRegistration
  verifiedNumber: MyVerifiedStudentNumber | null
}

/** Questions a student waiting for the account linking email asks, while one is still to come. */
export const LinkingEmailQuestions: React.FC<LinkingEmailQuestionsProps> = ({
  registration,
  verifiedNumber,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const band = studentNumberLinkBand(registration, verifiedNumber, { isAccountLinkingEnabled })
  if (band?.kind !== "awaiting-enrolment" && band?.kind !== "mailing" && band?.kind !== "mailed") {
    return null
  }

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
              subject={t("credit-registration-faq-no-email-support-subject", {
                course: registration.course_name,
              })}
              bodyLines={[]}
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
