"use client"

import { css } from "@emotion/css"
import { Clock, Envelope, LinkChain } from "@vectopus/atlas-icons-react"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { dateToString } from "@/shared-module/common/utils/time"

import { CREDIT_REGISTRATION_NS, SUPPORT_EMAIL, SUPPORT_MAIL_INLINE } from "../constants"
import { SisuCourseCode } from "../SisuCourseCode"
import { missingLinkingEmailSupportMail } from "../studentSupportMail"
import SupportMailLink from "../SupportMailLink"
import type { StudentNumberLinkBand } from "../trackerView"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import { captionCss, noteBoxCss, pageCss, pageHeadingCss } from "./stepperStyles"

const ICON_SIZE = 20

const factsCss = css`
  display: grid;
  row-gap: var(--space-5);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
`

const factCss = css`
  display: grid;
  grid-template-columns: 40px 1fr;
  column-gap: 14px;
  align-items: center;
`

/** Pulled into the title's line box, so the circle centres on the title rather than the row. */
const factIconCss = css`
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin: -8px 0;
  border-radius: 50%;
  background: var(--color-green-75);
  color: var(--color-green-600);
`

const factTitleCss = css`
  font-weight: 600;
`

const factDetailCss = css`
  grid-column: 2;
  margin-top: var(--space-1);
  color: var(--color-gray-500);
`

const Fact: React.FC<{
  icon: React.ReactNode
  title: React.ReactNode
  children?: React.ReactNode
}> = ({ icon, title, children }) => (
  <li className={factCss}>
    <span className={factIconCss} aria-hidden="true">
      {icon}
    </span>
    <div className={factTitleCss}>{title}</div>
    {children ? <div className={factDetailCss}>{children}</div> : null}
  </li>
)

export interface LinkingPageProps {
  /** `null` before the registration exists, when no email can have been claimed yet either. */
  band: StudentNumberLinkBand | null
  isSisu: boolean
  courseName: string
  courseCode: string | null
  /** What follows the explanation: the enrolment check box, the recheck lever, the way back. */
  children?: React.ReactNode
}

/**
 * How the student number gets linked: the email we send once we see the enrolment, and the link
 * in it. Once an email exists its state replaces the first row.
 */
export const LinkingPage: React.FC<LinkingPageProps> = ({
  band,
  isSisu,
  courseName,
  courseCode,
  children,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const supportMail = missingLinkingEmailSupportMail(t, courseName)
  const missingEmailSupportLink = (
    <SupportMailLink
      appearance={SUPPORT_MAIL_INLINE}
      label={SUPPORT_EMAIL}
      subject={supportMail.subject}
      bodyLines={supportMail.bodyLines}
    />
  )

  const linkFact = (
    <Fact icon={<LinkChain size={ICON_SIZE} />} title={t("credit-registration-linking-open-link")}>
      {t("credit-registration-linking-after-open")}
    </Fact>
  )

  const facts = (() => {
    switch (band?.kind) {
      case "staff-links":
        return <p>{t("credit-registration-link-staff-links-body")}</p>
      case "send-failed":
        return (
          <ul className={factsCss}>
            <Fact
              icon={<Envelope size={ICON_SIZE} />}
              title={t("credit-registration-linking-email-send-failed")}
            />
          </ul>
        )
      case "contact-support":
        return (
          <ul className={factsCss}>
            <Fact
              icon={<Envelope size={ICON_SIZE} />}
              title={t("credit-registration-link-heading-not-connected")}
            >
              {t("credit-registration-link-contact-support-body")} {missingEmailSupportLink}
            </Fact>
          </ul>
        )
      case "mailed":
        return (
          <ul className={factsCss}>
            <Fact
              icon={<Envelope size={ICON_SIZE} />}
              title={t("credit-registration-link-heading-mailed")}
            >
              <p>
                {t("credit-registration-link-mailed-body", {
                  email: band.emailMasked,
                  date: dateToString(band.sentAt),
                })}
              </p>
              <p>
                {isAccountLinkingEnabled
                  ? t("credit-registration-link-mailed-note")
                  : t("credit-registration-link-mailed-note-no-resend")}
              </p>
            </Fact>
            {linkFact}
          </ul>
        )
      case "link-expired":
        return (
          <ul className={factsCss}>
            <Fact
              icon={<Envelope size={ICON_SIZE} />}
              title={t("credit-registration-link-heading-expired")}
            >
              {t("credit-registration-link-expired-body", {
                email: band.emailMasked,
                date: dateToString(band.sentAt),
              })}
            </Fact>
            {linkFact}
          </ul>
        )
      default:
        return (
          <ul className={factsCss}>
            <Fact
              icon={<Envelope size={ICON_SIZE} />}
              title={
                isSisu
                  ? t("credit-registration-linking-email-to-sisu-address")
                  : t("credit-registration-linking-email-to-enrolment-address")
              }
            >
              {isSisu
                ? t("credit-registration-linking-email-detail-sisu")
                : t("credit-registration-linking-email-detail-open-university")}
            </Fact>
            <Fact
              icon={<Clock size={ICON_SIZE} />}
              title={t("credit-registration-linking-timing")}
            />
            {linkFact}
          </ul>
        )
    }
  })()

  return (
    <div className={pageCss}>
      <h2 className={pageHeadingCss} tabIndex={-1}>
        {t("credit-registration-linking-heading")}
      </h2>
      {facts}
      <p className={captionCss}>{t("credit-registration-link-only-once")}</p>
      {courseCode ? (
        <p className={noteBoxCss}>
          <Trans
            t={t}
            i18nKey="credit-registration-linking-wrong-course"
            components={{ courseCode: <SisuCourseCode code={courseCode} /> }}
          />
        </p>
      ) : null}
      {children}
    </div>
  )
}
