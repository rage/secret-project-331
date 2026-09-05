"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  registrationErrorHelp,
  registrationExplanation,
  registrationStatusLabel,
  registrationStatusState,
} from "@/components/credit-registration/creditRegistrationCopy"
import { NotificationEmailLine } from "@/components/credit-registration/EmailStatusLine"
import SectionCard from "@/components/credit-registration/SectionCard"
import { getMyCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  MyCreditRegistration,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import {
  completionRegistrationRoute,
  profileStudiesRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult, RegistrationStatusBadge } from "@/shared-module/components"

/** The statuses that are either the student's to fix or ours to answer for. */
const NEEDS_ATTENTION: readonly StudentFacingCreditRegistrationStatus[] = [
  "needs_student_number",
  "needs_enrolment",
  "failed",
]

const listCss = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  align-self: stretch;
`

const rowCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-clear-200);

  &:first-of-type {
    padding-top: 0;
    border-top: none;
  }
`

const rowHeaderCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
`

const moduleNameCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

const explanationCss = css`
  margin: 0;
  color: var(--color-gray-600);
`

/**
 * The registrations a student may need to do something about. Everything that is simply on its way
 * lives beside the course on the studies tab, so it is not repeated here.
 */
const RegistrationsNeedingAttention: React.FC = () => {
  const { t } = useTranslation()
  const query = useQuery({ ...getMyCreditRegistrationsOptions() })

  return (
    <SectionCard title={t("heading-credit-registrations-needing-attention")}>
      <QueryResult query={query} treatEmptyAsData>
        {(registrations) => {
          const needingAttention = registrations.filter(
            (registration) =>
              !registration.superseded &&
              NEEDS_ATTENTION.includes(registration.student_facing_status),
          )
          if (needingAttention.length === 0) {
            return (
              <>
                <p>{t("credit-registration-nothing-needs-your-attention")}</p>
                <Link href={profileStudiesRoute()}>{t("heading-your-studies")}</Link>
              </>
            )
          }
          return (
            <ul className={listCss}>
              {needingAttention.map((registration) => (
                <AttentionRow key={registration.id} registration={registration} />
              ))}
            </ul>
          )
        }}
      </QueryResult>
    </SectionCard>
  )
}

const AttentionRow: React.FC<{ registration: MyCreditRegistration }> = ({ registration }) => {
  const { t } = useTranslation()
  const status = registration.student_facing_status
  const errorHelp = registrationErrorHelp(t, registration.error_code)

  return (
    <li className={rowCss}>
      <div className={rowHeaderCss}>
        <span className={moduleNameCss}>
          {registration.course_module_name ?? registration.course_name}
        </span>
        <RegistrationStatusBadge state={registrationStatusState(status)}>
          {registrationStatusLabel(t, status)}
        </RegistrationStatusBadge>
      </div>
      <p className={explanationCss}>{registrationExplanation(t, status)}</p>
      {errorHelp ? <p className={explanationCss}>{errorHelp}</p> : null}
      <NotificationEmailLine notificationEmail={registration.notification_email} />
      <Link href={completionRegistrationRoute(registration.course_module_id)}>
        {t("credit-registration-what-to-do-about-this")}
      </Link>
    </li>
  )
}

export default withErrorBoundary(RegistrationsNeedingAttention)
