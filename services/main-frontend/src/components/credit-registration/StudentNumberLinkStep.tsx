"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { MyCreditRegistration, MyVerifiedStudentNumber } from "@/generated/api/types.generated"
import { humanReadableDate } from "@/shared-module/common/utils/time"

import { CREDIT_REGISTRATION_NS } from "./constants"
import { RegistrationActions, type RegistrationCardAction } from "./RegistrationStatusCard"
import { bandCss, noteCss, stepsCss, subheadingCss } from "./styles"
import { studentNumberLinkBand } from "./trackerView"

export interface StudentNumberLinkStepProps {
  registration: MyCreditRegistration
  verifiedNumber: MyVerifiedStudentNumber | null
  /**
   * The fast track out of the whole mail step: an address this account has proved it controls can
   * match the one the registry holds. Only offered before a mail has gone out, by which point it
   * has already missed.
   */
  confirmEmailAction: RegistrationCardAction | null
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
  confirmEmailAction,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const band = studentNumberLinkBand(registration, verifiedNumber)
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

  if (band.kind === "mailing") {
    return (
      <section className={bandCss}>
        <h2 className={subheadingCss}>{t("credit-registration-link-heading-mailing")}</h2>
        <p>{t("credit-registration-link-mailing-body")}</p>
        <p className={noteCss}>{t("credit-registration-link-mailing-note")}</p>
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
        <p className={noteCss}>{t("credit-registration-link-mailed-note")}</p>
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
      {confirmEmailAction ? (
        <>
          <p>{t("credit-registration-link-fast-track-offer")}</p>
          <RegistrationActions primaryAction={confirmEmailAction} />
        </>
      ) : null}
    </section>
  )
}
