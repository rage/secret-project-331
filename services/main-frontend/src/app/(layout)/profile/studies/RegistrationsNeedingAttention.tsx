"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  CREDIT_REGISTRATION_NS,
  MIDDLE_DOT,
  STATE_ACTION_NEEDED,
  STATE_FAILED,
  TIME_DATE,
} from "@/components/credit-registration/constants"
import {
  registrationStatusLabel,
  registrationStatusState,
} from "@/components/credit-registration/creditRegistrationCopy"
import RegistrationStatusCard from "@/components/credit-registration/RegistrationStatusCard"
import { useStudentRegistrationActions } from "@/components/credit-registration/studentRegistrationActions"
import { StudentRegistrationExplanation } from "@/components/credit-registration/StudentRegistrationExplanation"
import {
  cardCss,
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
import { useCanConfirmEmailAddress } from "@/components/credit-registration/useCanConfirmEmailAddress"
import { getMyCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import type { RegistrationStatusState } from "@/shared-module/components"
import { QueryResult, RelativeTime } from "@/shared-module/components"

/**
 * The registrations a student is being asked to do something about, and the ones that did not go
 * through, under headings that say which is which — a student told a failure needs their attention
 * looks for a lever that is not there.
 *
 * Everything simply on its way lives beside the course further down the page. Renders nothing when
 * there is nothing to show: a heading over "nothing needs your attention" tells a student nothing
 * the course list below does not.
 */
const RegistrationsNeedingAttention: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const query = useQuery({ ...getMyCreditRegistrationsOptions() })

  return (
    <QueryResult query={query} treatEmptyAsData contentClassName={sectionsCss}>
      {(registrations) => {
        const live = registrations.filter((registration) => !registration.superseded)
        const inState = (state: RegistrationStatusState) =>
          live.filter(
            (registration) => registrationStatusState(registration.student_facing_status) === state,
          )
        const actionNeeded = inState(STATE_ACTION_NEEDED)
        const failed = inState(STATE_FAILED)
        if (actionNeeded.length === 0 && failed.length === 0) {
          return null
        }
        return (
          <>
            <AttentionSection
              heading={t("heading-something-you-need-to-do")}
              registrations={actionNeeded}
            />
            <AttentionSection
              heading={t("heading-credits-that-did-not-go-through")}
              registrations={failed}
            />
          </>
        )
      }}
    </QueryResult>
  )
}

const AttentionSection: React.FC<{
  heading: string
  registrations: MyCreditRegistration[]
}> = ({ heading, registrations }) =>
  registrations.length === 0 ? null : (
    <section className={sectionCss}>
      <h2 className={headingCss}>{heading}</h2>
      {registrations.map((registration) => (
        <AttentionCard key={registration.id} registration={registration} />
      ))}
    </section>
  )

const AttentionCard: React.FC<{ registration: MyCreditRegistration }> = ({ registration }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const status = registration.student_facing_status
  const canConfirmEmail = useCanConfirmEmailAddress()
  const { primaryAction, secondaryActions } = useStudentRegistrationActions({
    registration,
    canConfirmEmail,
    linkToStatusPage: true,
  })

  const subject = registration.course_module_name
    ? `${registration.course_name}${MIDDLE_DOT}${registration.course_module_name}`
    : registration.course_name

  return (
    <RegistrationStatusCard
      className={cardCss}
      state={registrationStatusState(status)}
      headline={registrationStatusLabel(t, status)}
      subject={subject}
      explanation={<StudentRegistrationExplanation registration={registration} />}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      meta={
        <p className={noteCss}>
          {t("credit-registration-course-part-completed")}{" "}
          <RelativeTime at={registration.completion_date} absoluteTime={TIME_DATE} />
        </p>
      }
    />
  )
}

export default withErrorBoundary(RegistrationsNeedingAttention)
