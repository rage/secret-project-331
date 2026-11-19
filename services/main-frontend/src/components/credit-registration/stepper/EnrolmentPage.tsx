"use client"

import { cx } from "@emotion/css"
import { ArrowUpFromSquare } from "@vectopus/atlas-icons-react"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { Button, Link, TransLink, useDialog } from "@/shared-module/components"
import { httpsUrlOrNull } from "@/utils/httpsUrl"

import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  ICON_AT_END,
  openUniversityEnrolmentInfoUrl,
  sisuEnrolmentInstructionsUrl,
  SUPPORT_EMAIL,
  SUPPORT_MAIL_INLINE,
} from "../constants"
import { useIsDemoMode } from "../demoMode"
import { SisuCourseCode } from "../SisuCourseCode"
import type { SupportMailContents } from "../studentSupportMail"
import SupportMailLink from "../SupportMailLink"
import {
  captionCss,
  footerCss,
  headingNumberCss,
  leadCss,
  numberedHeadingCss,
  pageCss,
  pageHeadingCss,
  sectionDividerCss,
  underNumberedHeadingCss,
  wideActionCss,
} from "./stepperStyles"

const EXTERNAL_ICON_SIZE = 16

const NumberedHeading: React.FC<{
  n: number
  children: React.ReactNode
  isPageHeading?: boolean
}> = ({ n, children, isPageHeading = false }) => (
  <h2
    className={cx(pageHeadingCss, numberedHeadingCss)}
    {...(isPageHeading ? { tabIndex: -1 } : {})}
  >
    <span className={headingNumberCss} aria-hidden="true">
      <span>{n}</span>
    </span>
    {children}
  </h2>
)

export interface EnrolmentPageProps {
  isSisu: boolean
  /** The course to enrol on; without one a Sisu student is sent to support instead. */
  courseCode: string | null
  /** Where an Open University student enrols, when the module names one. */
  openUniversityEnrolmentLink: string | null | undefined
  /** What the support mail says when there is no course code to enrol on. */
  missingCourseCodeSupportMail: SupportMailContents
  isConfirming: boolean
  onConfirm: () => void
  onChangeAnswers: () => void
}

/** How to enrol, and the student's word that they have. */
export const EnrolmentPage: React.FC<EnrolmentPageProps> = ({
  isSisu,
  courseCode,
  openUniversityEnrolmentLink,
  missingCourseCodeSupportMail,
  isConfirming,
  onConfirm,
  onChangeAnswers,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const isDemoMode = useIsDemoMode()
  const { alert, confirm } = useDialog()
  const enrolmentLink = httpsUrlOrNull(openUniversityEnrolmentLink)
  const externalIcon = <ArrowUpFromSquare size={EXTERNAL_ICON_SIZE} aria-hidden="true" />

  // A "yes" too early sends the student to wait for an email that is not coming, so "Not yet" is
  // the answer the dialog leans on.
  const askAndConfirm = async () => {
    const hasEnrolled = await confirm({
      title: t("credit-registration-confirm-enrolled-title"),
      message: isSisu
        ? t("credit-registration-confirm-enrolled-body-sisu")
        : t("credit-registration-confirm-enrolled-body-open-university"),
      confirmLabel: t("credit-registration-confirm-enrolled-yes"),
      cancelLabel: t("credit-registration-confirm-enrolled-not-yet"),
      emphasizesCancel: true,
    })
    if (hasEnrolled) {
      onConfirm()
    }
  }

  const footer = (
    <div className={footerCss}>
      <Button variant={BUTTON_TERTIARY} size="medium" onClick={onChangeAnswers}>
        {t("credit-registration-change-your-answers")}
      </Button>
    </div>
  )

  if (isSisu && !courseCode) {
    return (
      <div className={pageCss}>
        <NumberedHeading n={1} isPageHeading>
          {t("credit-registration-enrol-in-sisu-heading")}
        </NumberedHeading>
        <div className={underNumberedHeadingCss}>
          <p>
            {t("credit-registration-sisu-course-code-missing")}{" "}
            <SupportMailLink
              appearance={SUPPORT_MAIL_INLINE}
              label={SUPPORT_EMAIL}
              subject={missingCourseCodeSupportMail.subject}
              bodyLines={missingCourseCodeSupportMail.bodyLines}
            />
          </p>
          <SupportMailLink
            referenceOnly
            reference={missingCourseCodeSupportMail.reference ?? null}
            subject={missingCourseCodeSupportMail.subject}
            bodyLines={missingCourseCodeSupportMail.bodyLines}
          />
        </div>
        {footer}
      </div>
    )
  }

  return (
    <div className={pageCss}>
      {isSisu ? (
        <>
          <NumberedHeading n={1} isPageHeading>
            {t("credit-registration-enrol-in-sisu-heading")}
          </NumberedHeading>
          <div className={underNumberedHeadingCss}>
            <p className={leadCss}>
              <Trans
                t={t}
                i18nKey="credit-registration-enrol-in-sisu-lead"
                components={{ courseCode: <SisuCourseCode code={courseCode ?? ""} /> }}
              />
            </p>
            <p>
              <TransLink
                href={sisuEnrolmentInstructionsUrl(i18n.language)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("credit-registration-how-to-enrol-in-sisu")}
              </TransLink>
            </p>
          </div>
        </>
      ) : (
        <>
          <NumberedHeading n={1} isPageHeading>
            {t("credit-registration-enrol-at-open-university-heading")}
          </NumberedHeading>
          <div className={underNumberedHeadingCss}>
            {courseCode ? (
              <p className={leadCss}>
                <Trans
                  t={t}
                  i18nKey="credit-registration-enrol-at-open-university-lead"
                  components={{ courseCode: <SisuCourseCode code={courseCode} /> }}
                />
              </p>
            ) : null}
            {isDemoMode ? (
              <div>
                <Button
                  variant={BUTTON_PRIMARY}
                  size="large"
                  icon={externalIcon}
                  iconPosition={ICON_AT_END}
                  className={wideActionCss}
                  onClick={() =>
                    void alert({
                      title: t("credit-registration-demo-enrol-dialog-title"),
                      message: t("credit-registration-demo-enrol-dialog-body"),
                    })
                  }
                >
                  {t("credit-registration-action-enrol")}
                </Button>
              </div>
            ) : enrolmentLink ? (
              <div>
                <Link
                  href={enrolmentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  styledAsButton
                  variant={BUTTON_PRIMARY}
                  size="large"
                  icon={externalIcon}
                  iconPosition={ICON_AT_END}
                  className={wideActionCss}
                >
                  {t("credit-registration-action-enrol")}
                </Link>
              </div>
            ) : (
              <p>{t("credit-registration-no-enrolment-link-available")}</p>
            )}
            <p className={captionCss}>
              <Trans
                t={t}
                i18nKey="credit-registration-open-university-identification-caption"
                components={{
                  openUniversityInfoLink: (
                    <TransLink
                      href={openUniversityEnrolmentInfoUrl(i18n.language)}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                }}
              />
            </p>
          </div>
        </>
      )}

      <div className={sectionDividerCss}>
        <NumberedHeading n={2}>
          {t("credit-registration-finished-enrolling-heading")}
        </NumberedHeading>
        <div className={underNumberedHeadingCss}>
          <div>
            <Button
              variant={BUTTON_SECONDARY}
              size="large"
              className={wideActionCss}
              isLoading={isConfirming}
              onClick={() => void askAndConfirm()}
            >
              {t("button-i-have-enrolled")}
            </Button>
          </div>
        </div>
      </div>
      {footer}
    </div>
  )
}
