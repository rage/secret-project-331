"use client"

import { css, cx } from "@emotion/css"
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
import { courseCodeOf, enrolmentLinkOf, type StepperCourse } from "./stepperView"

const EXTERNAL_ICON_SIZE = 16

const courseListCss = css`
  margin: 0;
  padding-left: var(--space-5);
`

const courseEnrolmentCss = css`
  display: grid;
  gap: var(--space-3);
`

/** The `courseCode` slot of a `Trans` that names `course`. */
const courseCodeSlot = (course: StepperCourse) => ({
  courseCode: <SisuCourseCode code={courseCodeOf(course) ?? ""} />,
})

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

/** What an Open University student needs to know about identifying themselves when enrolling. */
export const OpenUniversityIdentificationCaption: React.FC = () => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
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
  )
}

export interface EnrolmentPageProps {
  isSisu: boolean
  /**
   * Every course the completion earns, each enrolled on separately. Without a course code for each,
   * a Sisu student is sent to support instead.
   */
  courses: readonly [StepperCourse, ...StepperCourse[]]
  /** The courses that wait for another before they go to Sisu. */
  laterCourses: readonly (StepperCourse & { prerequisiteName: string })[]
  /** What the support mail says when there is no course code to enrol on. */
  missingCourseCodeSupportMail: SupportMailContents
  isConfirming: boolean
  onConfirm: () => void
  onChangeAnswers: () => void
}

/** How to enrol, and the student's word that they have. */
export const EnrolmentPage: React.FC<EnrolmentPageProps> = ({
  isSisu,
  courses,
  laterCourses,
  missingCourseCodeSupportMail,
  isConfirming,
  onConfirm,
  onChangeAnswers,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const isDemoMode = useIsDemoMode()
  const { alert, confirm } = useDialog()
  const externalIcon = <ArrowUpFromSquare size={EXTERNAL_ICON_SIZE} aria-hidden="true" />
  const count = courses.length
  const hasSeveralCourses = count > 1
  const [firstCourse] = courses
  const firstCourseCode = courseCodeOf(firstCourse)

  // A "yes" too early sends the student to wait for an email that is not coming, so "Not yet" is
  // the answer the dialog leans on.
  const askAndConfirm = async () => {
    const hasEnrolled = await confirm({
      title: t("credit-registration-confirm-enrolled-title"),
      message: isSisu
        ? t("credit-registration-confirm-enrolled-body-sisu", { count })
        : t("credit-registration-confirm-enrolled-body-open-university", { count }),
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

  if (isSisu && courses.some((course) => !courseCodeOf(course))) {
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

  const enrolButton = (link: string | null, label: string) =>
    isDemoMode ? (
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
          {label}
        </Button>
      </div>
    ) : link ? (
      <div>
        <Link
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          styledAsButton
          variant={BUTTON_PRIMARY}
          size="large"
          icon={externalIcon}
          iconPosition={ICON_AT_END}
          className={wideActionCss}
        >
          {label}
        </Link>
      </div>
    ) : (
      <p>{t("credit-registration-no-enrolment-link-available")}</p>
    )

  const laterCaptions = laterCourses.map((course) => (
    <p key={course.key} className={captionCss}>
      {t("credit-registration-courses-registered-after", {
        course: course.name,
        prerequisite: course.prerequisiteName,
      })}
    </p>
  ))

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
                count={count}
                components={courseCodeSlot(firstCourse)}
              />
            </p>
            {hasSeveralCourses ? (
              <ul className={courseListCss}>
                {courses.map((course) => (
                  <li key={course.key}>
                    <Trans
                      t={t}
                      i18nKey="credit-registration-courses-list-item"
                      values={{ course: course.name }}
                      components={courseCodeSlot(course)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {laterCaptions}
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
            {hasSeveralCourses ? (
              <>
                <p>{t("credit-registration-courses-enrol-intro", { count })}</p>
                {courses.map((course) => (
                  <div key={course.key} className={courseEnrolmentCss}>
                    <p className={leadCss}>
                      <Trans
                        t={t}
                        i18nKey="credit-registration-courses-enrol-on-course-lead"
                        values={{ course: course.name }}
                        components={courseCodeSlot(course)}
                      />
                    </p>
                    {enrolButton(
                      httpsUrlOrNull(enrolmentLinkOf(course)),
                      t("credit-registration-action-enrol-on-course", { course: course.name }),
                    )}
                  </div>
                ))}
              </>
            ) : (
              <>
                {firstCourseCode ? (
                  <p className={leadCss}>
                    <Trans
                      t={t}
                      i18nKey="credit-registration-enrol-at-open-university-lead"
                      components={courseCodeSlot(firstCourse)}
                    />
                  </p>
                ) : null}
                {enrolButton(
                  httpsUrlOrNull(enrolmentLinkOf(firstCourse)),
                  t("credit-registration-action-enrol"),
                )}
              </>
            )}
            {laterCaptions}
            <OpenUniversityIdentificationCaption />
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
          {hasSeveralCourses ? (
            <p className={captionCss}>{t("credit-registration-courses-enrolled-on-some")}</p>
          ) : null}
        </div>
      </div>
      {footer}
    </div>
  )
}
