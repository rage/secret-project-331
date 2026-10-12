"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type {
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
} from "@/generated/api/types.generated"
import { humanReadableDate } from "@/shared-module/common/utils/time"

import { CREDIT_REGISTRATION_NS, SUPPORT_EMAIL } from "./constants"
import { missingLinkingEmailSupportMail } from "./studentSupportMail"
import { bandCss, noteCss, stepsCss, subheadingCss } from "./styles"
import SupportMailLink from "./SupportMailLink"
import { isLinkingEmailOverdue, studentNumberLinkBand } from "./trackerView"
import { useIsAccountLinkingEnabled } from "./useIsAccountLinkingEnabled"

const SUPPORT_LINK_IN_TEXT = "link"

/** A mail to support, prefilled for a linking email that never came. */
const MissingEmailSupportLink: React.FC<{ courseName: string }> = ({ courseName }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const supportMail = missingLinkingEmailSupportMail(t, courseName)
  return (
    <SupportMailLink
      appearance={SUPPORT_LINK_IN_TEXT}
      label={SUPPORT_EMAIL}
      subject={supportMail.subject}
      bodyLines={supportMail.bodyLines}
    />
  )
}

export interface StudentNumberLinkStepProps {
  registration: MyCreditRegistration
  verifiedNumber: MyVerifiedStudentNumber | null
  enrolmentRoute: MyEnrolmentRoute | null
}

/**
 * Which student number these credits go to, and — when none is attached yet — how one gets there.
 *
 * Above the enrolment instructions on purpose: the mail that does the linking is addressed from the
 * study registry's roster, so it cannot arrive until the student has enrolled, and a student who
 * leaves after enrolling has to already know to watch a mailbox that is often not the one on this
 * account.
 */
export const StudentNumberLinkStep: React.FC<StudentNumberLinkStepProps> = ({
  registration,
  verifiedNumber,
  enrolmentRoute,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const [nowMs] = useState(() => Date.now())
  const band = studentNumberLinkBand(registration, verifiedNumber, {
    isAccountLinkingEnabled,
    enrolmentRoute,
  })
  if (band === null) {
    return null
  }

  if (band.kind === "registering" || band.kind === "linked") {
    const heading =
      band.kind === "registering"
        ? t("credit-registration-link-heading-registering", { studentNumber: band.studentNumber })
        : t("credit-registration-link-heading-linked", { studentNumber: band.studentNumber })
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{heading}</h2>
        <p className={noteCss}>
          {band.kind === "registering"
            ? t("credit-registration-link-not-your-number-active")
            : t("credit-registration-link-not-your-number")}
        </p>
      </section>
    )
  }

  if (band.kind === "send-failed") {
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{t("credit-registration-link-heading-not-connected")}</h2>
        <p>{t("credit-registration-linking-email-send-failed")}</p>
      </section>
    )
  }

  if (band.kind === "staff-links") {
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{t("credit-registration-link-heading-not-connected")}</h2>
        <p>{t("credit-registration-link-staff-links-body")}</p>
      </section>
    )
  }

  if (band.kind === "contact-support") {
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{t("credit-registration-link-heading-not-connected")}</h2>
        <p>
          {t("credit-registration-link-contact-support-body")}{" "}
          <MissingEmailSupportLink courseName={registration.course_name} />
        </p>
      </section>
    )
  }

  if (band.kind === "awaiting-email") {
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{t("credit-registration-link-heading-awaiting-email")}</h2>
        <p>
          {band.isOpenUniversity
            ? t("credit-registration-link-awaiting-email-body-open-university")
            : t("credit-registration-link-awaiting-email-body")}
        </p>
        {isLinkingEmailOverdue(band.waitingSince, nowMs) ? (
          <p>
            {t("credit-registration-link-awaiting-email-overdue")}{" "}
            <MissingEmailSupportLink courseName={registration.course_name} />
          </p>
        ) : (
          <p className={noteCss}>{t("credit-registration-link-only-once")}</p>
        )}
      </section>
    )
  }

  if (band.kind === "link-expired") {
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{t("credit-registration-link-heading-expired")}</h2>
        <p>
          {t("credit-registration-link-expired-body", {
            email: band.emailMasked,
            date: humanReadableDate(band.sentAt, i18n.language),
          })}
        </p>
      </section>
    )
  }

  if (band.kind === "mailed") {
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{t("credit-registration-link-heading-mailed")}</h2>
        <p>
          {t("credit-registration-link-mailed-body", {
            email: band.emailMasked,
            date: humanReadableDate(band.sentAt, i18n.language),
          })}
        </p>
        <p className={noteCss}>
          {isAccountLinkingEnabled
            ? t("credit-registration-link-mailed-note")
            : t("credit-registration-link-mailed-note-no-resend")}
        </p>
      </section>
    )
  }

  return (
    <section className={bandCss}>
      <h2 className={subheadingCss}>{t("credit-registration-link-heading-not-connected")}</h2>
      <p>{t("credit-registration-link-intro")}</p>
      <ol className={stepsCss}>
        <li>{t("credit-registration-link-step-enrol")}</li>
        <li>{t("credit-registration-link-step-email")}</li>
        <li>{t("credit-registration-link-step-open")}</li>
      </ol>
      <p className={noteCss}>{t("credit-registration-link-only-once")}</p>
    </section>
  )
}
