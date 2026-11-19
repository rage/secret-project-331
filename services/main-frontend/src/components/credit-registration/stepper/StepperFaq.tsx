"use client"

import { css } from "@emotion/css"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { Disclosure } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, SUPPORT_EMAIL, SUPPORT_MAIL_INLINE } from "../constants"
import { missingLinkingEmailSupportMail } from "../studentSupportMail"
import SupportMailLink from "../SupportMailLink"
import { omaOpintopolkuLink, sisuLink } from "./StatusPage"
import type { StatusPage, StepperPage } from "./stepperView"

const faqCss = css`
  display: grid;
  gap: var(--space-3);
`

const faqTitleCss = css`
  margin: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 600;
`

export interface StepperFaqProps {
  page: StepperPage | StatusPage
  isSisu: boolean
  courseName: string
}

/** The questions students ask on the page they are on, and only those. */
export const StepperFaq: React.FC<StepperFaqProps> = ({ page, isSisu, courseName }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAwaitingEnrolment = page === "linking" || page === "waiting"
  const asksAboutEnrolment = page === "enrolment" || isAwaitingEnrolment
  const asksWhenVisible = page === "registering" || page === "registered"
  if (!asksAboutEnrolment && !asksWhenVisible) {
    return null
  }
  const supportMail = missingLinkingEmailSupportMail(t, courseName)

  return (
    <section className={faqCss}>
      <h2 className={faqTitleCss}>{t("credit-registration-faq-title")}</h2>
      {asksAboutEnrolment ? (
        <Disclosure title={t("credit-registration-faq-enrolment-not-noticed-question")}>
          <p>{t("credit-registration-faq-enrolment-not-noticed-answer")}</p>
        </Disclosure>
      ) : null}
      {isAwaitingEnrolment ? (
        <Disclosure title={t("credit-registration-faq-how-to-enrol-question")}>
          <p>{t("credit-registration-faq-how-to-enrol-answer")}</p>
        </Disclosure>
      ) : null}
      {page === "linking" ? (
        <>
          <Disclosure title={t("credit-registration-faq-linking-email-address-question")}>
            <p>
              {/* Logging in to Sisu needs a University of Helsinki account. */}
              {isSisu
                ? t("credit-registration-faq-linking-email-address-answer")
                : t("credit-registration-faq-linking-email-address-answer-open-university")}{" "}
              <SupportMailLink
                appearance={SUPPORT_MAIL_INLINE}
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
      {asksWhenVisible ? (
        <Disclosure title={t("credit-registration-faq-when-can-i-see-question")}>
          <p>
            {isSisu ? (
              <Trans
                t={t}
                i18nKey="credit-registration-faq-when-can-i-see-answer-sisu"
                components={{ sisuLink, omaOpintopolkuLink }}
              />
            ) : (
              <Trans
                t={t}
                i18nKey="credit-registration-faq-when-can-i-see-answer-oma-opintopolku"
                components={{ omaOpintopolkuLink }}
              />
            )}
          </p>
        </Disclosure>
      ) : null}
    </section>
  )
}
