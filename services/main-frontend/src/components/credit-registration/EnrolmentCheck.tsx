"use client"

import React from "react"
import { Trans, useTranslation } from "react-i18next"

import type { MyCreditRegistration, MyEnrolmentRoute } from "@/generated/api/types.generated"
import useTime from "@/hooks/course-material/useTime"
import { dateToString } from "@/shared-module/common/utils/time"
import { Infobox } from "@/shared-module/components"
import { formatIsoDate } from "@/shared-module/components/lib/utils/relativeTimeFormat"

import {
  CREDIT_REGISTRATION_NS,
  OPEN_UNIVERSITY,
  SUPPORT_EMAIL,
  SUPPORT_MAIL_INLINE,
  TONE,
} from "./constants"
import { registrationErrorHelp } from "./creditRegistrationCopy"
import { SisuCourseCode } from "./SisuCourseCode"
import { unseenEnrolmentSupportMail } from "./studentSupportMail"
import { bandCss, stepsCss, subsectionCss } from "./styles"
import SupportMailLink from "./SupportMailLink"
import { enrolmentCheckOpening } from "./trackerView"

/** Fine enough for a box whose earliest trigger is hours after the press. */
const CLOCK_TICK_MS = 60_000
const SUPPORT_AFTER_DAYS = 3
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface EnrolmentCheckProps {
  registration: MyCreditRegistration
  enrolmentRoute: MyEnrolmentRoute | null
  hasLinkedStudentNumber: boolean
}

/**
 * What to check when the enrolment the student said they made has not turned up, and when to
 * involve support. Rendered beside the enrolment answer; hides itself until it applies.
 */
export const EnrolmentCheck: React.FC<EnrolmentCheckProps> = ({
  registration,
  enrolmentRoute,
  hasLinkedStudentNumber,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  // Ticks so the box appears on a page left open past the threshold.
  const now = useTime(CLOCK_TICK_MS)
  const opening = enrolmentCheckOpening(
    { registration, enrolmentRoute },
    hasLinkedStudentNumber,
    now.getTime(),
  )
  const confirmedAt = enrolmentRoute?.enrolment_confirmed_at
  if (opening === null || !confirmedAt) {
    return null
  }

  const supportDate = formatIsoDate(
    new Date(new Date(confirmedAt).getTime() + SUPPORT_AFTER_DAYS * MS_PER_DAY),
  )
  const supportMail = unseenEnrolmentSupportMail(t, registration, dateToString(confirmedAt))
  const sisuCourseCode = registration.uh_course_code?.trim() || null

  return (
    <section className={bandCss}>
      <Infobox tone={TONE.WARNING} heading={t("credit-registration-enrolment-check-heading")}>
        <div className={subsectionCss}>
          <p>
            {opening.kind === "registry-verdict"
              ? registrationErrorHelp(t, opening.errorCode)
              : t("credit-registration-enrolment-check-still-not-seen")}
          </p>
          {enrolmentRoute?.route === OPEN_UNIVERSITY ? (
            <>
              <p>{t("credit-registration-enrolment-check-open-university-intro")}</p>
              <ul className={stepsCss}>
                <li>{t("credit-registration-enrolment-check-open-university-instructions")}</li>
                <li>{t("credit-registration-enrolment-check-open-university-course")}</li>
              </ul>
            </>
          ) : sisuCourseCode ? (
            <p>
              <Trans
                t={t}
                i18nKey="credit-registration-enrolment-check-sisu-course"
                components={{ courseCode: <SisuCourseCode code={sisuCourseCode} /> }}
              />
            </p>
          ) : null}
          <p>{t("credit-registration-enrolment-check-nothing-to-do")}</p>
          <p>
            {t("credit-registration-enrolment-check-support", { date: supportDate })}{" "}
            <SupportMailLink
              appearance={SUPPORT_MAIL_INLINE}
              label={SUPPORT_EMAIL}
              subject={supportMail.subject}
              bodyLines={supportMail.bodyLines}
            />
          </p>
        </div>
      </Infobox>
    </section>
  )
}
