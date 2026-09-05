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
import {
  dividedListCss,
  emptyStateCss,
  headingCss,
  rowCss,
  sectionCss,
} from "@/components/credit-registration/styles"
import { getMyCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  MyCreditRegistration,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import { completionRegistrationRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult, RegistrationStatusBadge } from "@/shared-module/components"

/** The statuses that are either the student's to fix or ours to answer for. */
const NEEDS_ATTENTION: readonly StudentFacingCreditRegistrationStatus[] = [
  "needs_student_number",
  "needs_enrolment",
  "failed",
]

const itemCss = css`
  display: grid;
  gap: var(--space-2);
`

const moduleNameCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

/**
 * The registrations a student may need to do something about. Everything that is simply on its way
 * lives beside the course on the studies tab, so it is not repeated here.
 */
const RegistrationsNeedingAttention: React.FC = () => {
  const { t } = useTranslation()
  const query = useQuery({ ...getMyCreditRegistrationsOptions() })

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("heading-credit-registrations-needing-attention")}</h2>
      <QueryResult query={query} treatEmptyAsData>
        {(registrations) => {
          const needingAttention = registrations.filter(
            (registration) =>
              !registration.superseded &&
              NEEDS_ATTENTION.includes(registration.student_facing_status),
          )
          if (needingAttention.length === 0) {
            return (
              <p className={emptyStateCss}>
                {t("credit-registration-nothing-needs-your-attention")}
              </p>
            )
          }
          return (
            <ul className={dividedListCss}>
              {needingAttention.map((registration) => (
                <AttentionRow key={registration.id} registration={registration} />
              ))}
            </ul>
          )
        }}
      </QueryResult>
    </section>
  )
}

const AttentionRow: React.FC<{ registration: MyCreditRegistration }> = ({ registration }) => {
  const { t } = useTranslation()
  const status = registration.student_facing_status
  const errorHelp = registrationErrorHelp(t, registration.error_code)

  return (
    <li className={itemCss}>
      <div className={rowCss}>
        <span className={moduleNameCss}>
          {registration.course_module_name ?? registration.course_name}
        </span>
        <RegistrationStatusBadge state={registrationStatusState(status)}>
          {registrationStatusLabel(t, status)}
        </RegistrationStatusBadge>
      </div>
      <p>{registrationExplanation(t, status)}</p>
      {errorHelp ? <p>{errorHelp}</p> : null}
      <NotificationEmailLine notificationEmail={registration.notification_email} />
      <Link href={completionRegistrationRoute(registration.course_module_id)}>
        {t("credit-registration-what-to-do-about-this")}
      </Link>
    </li>
  )
}

export default withErrorBoundary(RegistrationsNeedingAttention)
