"use client"

import React from "react"
import { Trans, useTranslation } from "react-i18next"

import type { MyCreditRegistration } from "@/generated/api/types.generated"
import { userSettingsStudentNumberRoute } from "@/shared-module/common/utils/routes"
import { humanReadableDate } from "@/shared-module/common/utils/time"
import { TransLink } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, SISU_URL } from "./constants"
import {
  registrationErrorHelp,
  registrationExplanation,
  registrationStatusState,
} from "./creditRegistrationCopy"
import { LinkingEmailLine, NotificationEmailLine, sentLinkingEmail } from "./EmailStatusLine"
import { failureActions } from "./registrationFailures"
import { monospaceCss, stepsCss, subsectionCss } from "./styles"

const sisuLink = <TransLink href={SISU_URL} target="_blank" rel="noopener noreferrer" />
const studentNumberSettingsLink = <TransLink href={userSettingsStudentNumberRoute()} />
const studentNumberValue = <span className={monospaceCss} />

const PERSON_NOT_FOUND = "person_not_found"
// Its own explanation already covers who acts and what happens next; appending the generic
// "nothing to do" sentence here would repeat "we are looking into it" and contradict it.
const MISREGISTERED = "misregistered"

/** The sentence, or the steps, that the state itself wants said. */
const MainExplanation: React.FC<{ registration: MyCreditRegistration }> = ({ registration }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const status = registration.student_facing_status

  if (status === "needs_student_number") {
    const sent = sentLinkingEmail(registration.linking_email)
    if (!sent) {
      return (
        <>
          <p>{registrationExplanation(t, status)}</p>
          <LinkingEmailLine linkingEmail={registration.linking_email} />
        </>
      )
    }
    return (
      <>
        <ol className={stepsCss}>
          <li>
            {t("credit-registration-student-number-step-open-the-emailed-link", {
              email: sent.emailMasked,
              date: humanReadableDate(sent.sentAt, i18n.language),
            })}
          </li>
          <li>{t("credit-registration-student-number-step-stay-logged-in")}</li>
        </ol>
        <p>{t("credit-registration-student-number-after-confirming")}</p>
      </>
    )
  }

  // The generic sentence names no number, so the wrong-number case cannot be checked from it.
  if (registration.error_code === PERSON_NOT_FOUND && registration.student_number) {
    return (
      <p>
        <Trans
          t={t}
          i18nKey="credit-registration-error-person-not-found-with-number"
          values={{ studentNumber: registration.student_number }}
          components={{
            number: studentNumberValue,
            settingsLink: studentNumberSettingsLink,
          }}
        />
      </p>
    )
  }

  const errorHelp = registrationErrorHelp(t, registration.error_code)
  if (errorHelp) {
    return <p>{errorHelp}</p>
  }
  if (status === "registered") {
    return (
      <p>
        <Trans
          t={t}
          i18nKey="credit-registration-explanation-registered"
          components={{ sisuLink }}
        />
      </p>
    )
  }
  return <p>{registrationExplanation(t, status)}</p>
}

export interface StudentRegistrationExplanationProps {
  registration: MyCreditRegistration
}

/**
 * What one registration's state means to the student it belongs to, and what happens next.
 *
 * The one place that answers it, so the hub and the status page cannot come to explain a state
 * differently. Pair it with `useStudentRegistrationActions`, which offers the matching levers.
 */
export const StudentRegistrationExplanation: React.FC<StudentRegistrationExplanationProps> = ({
  registration,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const status = registration.student_facing_status
  const state = registrationStatusState(status)
  const isNobodyElsesToFix =
    state === "failed" &&
    registration.error_code !== MISREGISTERED &&
    failureActions(registration.error_code, "student").primary === null

  return (
    <div className={subsectionCss}>
      <MainExplanation registration={registration} />
      {/* Otherwise raising a grade and seeing "registered" unchanged reads as a lost submission. */}
      {registration.registry_already_held_equal_or_better ? (
        <p>{t("credit-registration-explanation-not-improved")}</p>
      ) : null}
      {isNobodyElsesToFix ? <p>{t("credit-registration-failed-not-yours-to-fix")}</p> : null}
      {status === "needs_enrolment" && !registration.enrolment_link ? (
        <p>{t("credit-registration-no-enrolment-link-available")}</p>
      ) : null}
      <NotificationEmailLine notificationEmail={registration.notification_email} />
    </div>
  )
}
