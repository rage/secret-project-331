"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { SUPPORT_EMAIL } from "@/components/credit-registration/constants"
import {
  registrationErrorHelp,
  registrationExplanation,
  registrationNeedsAttention,
  registrationStatusLabel,
  registrationStatusState,
} from "@/components/credit-registration/creditRegistrationCopy"
import { NotificationEmailLine } from "@/components/credit-registration/EmailStatusLine"
import {
  dividedListCss,
  headingCss,
  noteCss,
  rowCss,
  sectionCss,
  sectionHeaderCss,
} from "@/components/credit-registration/styles"
import { getMyCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import { completionRegistrationRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult, RegistrationStatusBadge } from "@/shared-module/components"

const titleCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

// oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
const supportMailLink = <a href={`mailto:${SUPPORT_EMAIL}`} />

/**
 * The registrations a student may need to do something about. Everything that is simply on its way
 * lives beside the course further down the page, so it is not repeated here.
 *
 * Renders nothing when there is nothing to show: a heading over "nothing needs your attention"
 * would tell a student nothing the course list below does not already show.
 */
const RegistrationsNeedingAttention: React.FC = () => {
  const { t } = useTranslation()
  const query = useQuery({ ...getMyCreditRegistrationsOptions() })

  return (
    <QueryResult query={query} treatEmptyAsData>
      {(registrations) => {
        const needingAttention = registrations.filter(
          (registration) =>
            !registration.superseded &&
            registrationNeedsAttention(registration.student_facing_status),
        )
        if (needingAttention.length === 0) {
          return null
        }
        return (
          <section className={sectionCss}>
            <h2 className={headingCss}>{t("heading-credit-registrations-needing-attention")}</h2>
            <ul className={dividedListCss}>
              {needingAttention.map((registration) => (
                <AttentionRow key={registration.id} registration={registration} />
              ))}
            </ul>
          </section>
        )
      }}
    </QueryResult>
  )
}

const AttentionRow: React.FC<{ registration: MyCreditRegistration }> = ({ registration }) => {
  const { t } = useTranslation()
  const status = registration.student_facing_status
  const state = registrationStatusState(status)
  const errorHelp = registrationErrorHelp(t, registration.error_code)

  return (
    <li className={sectionHeaderCss}>
      <div className={rowCss}>
        <span className={titleCss}>{registration.course_name}</span>
        <RegistrationStatusBadge state={state}>
          {registrationStatusLabel(t, status)}
        </RegistrationStatusBadge>
      </div>
      {registration.course_module_name ? (
        <p className={noteCss}>{registration.course_module_name}</p>
      ) : null}
      <p>{errorHelp ?? registrationExplanation(t, status)}</p>
      {state === "failed" ? (
        <p className={noteCss}>
          <Trans
            t={t}
            i18nKey="credit-registration-contact-support"
            values={{ email: SUPPORT_EMAIL }}
            components={{ mailLink: supportMailLink }}
          />
        </p>
      ) : null}
      <NotificationEmailLine notificationEmail={registration.notification_email} />
      <Link href={completionRegistrationRoute(registration.course_module_id)}>
        {t("credit-registration-registration-details")}
      </Link>
    </li>
  )
}

export default withErrorBoundary(RegistrationsNeedingAttention)
