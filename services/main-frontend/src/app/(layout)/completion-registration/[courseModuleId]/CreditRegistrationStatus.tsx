"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import {
  registrationErrorHelp,
  registrationExplanation,
  registrationGradeLabel,
  registrationStatusLabel,
  registrationStatusState,
  registrationStepperSteps,
} from "@/components/credit-registration/creditRegistrationCopy"
import { useRequestEnrolmentRecheck } from "@/components/credit-registration/enrolmentActions"
import LinkingEmailLine from "@/components/credit-registration/LinkingEmailLine"
import NotificationEmailLine from "@/components/credit-registration/NotificationEmailLine"
import { getMyCreditRegistrationForCourseModuleOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import { useSetCreditRegistrationConsent } from "@/hooks/course-material/useCourseCreditRegistrationConsent"
import {
  userSettingsStudentNumberRoute,
  profileCreditRegistrationRoute,
} from "@/shared-module/common/utils/routes"
import {
  Button,
  DescriptionList,
  Infobox,
  Link,
  QueryResult,
  RegistrationStatusBadge,
  RegistrationStatusStepper,
} from "@/shared-module/components"

export interface CreditRegistrationStatusProps {
  courseModuleId: string
  heading: string
  ectsCredits: number | null | undefined
}

const MOVING_REFETCH_INTERVAL_MS = 10_000
/** Sisu answers on its own schedule, so polling it hard buys nothing. */
const WAITING_FOR_SISU_REFETCH_INTERVAL_MS = 60_000

const pageCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin: 2rem 0 4rem;
`

const headerCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;

  h1 {
    margin: 0;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }
`

const infoboxBodyCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  p {
    margin: 0;
  }
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
`

const attemptsCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  h3 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }
`

const CreditRegistrationStatus: React.FC<CreditRegistrationStatusProps> = ({
  courseModuleId,
  heading,
  ectsCredits,
}) => {
  const { t } = useTranslation()
  const query = useQuery({
    ...getMyCreditRegistrationForCourseModuleOptions({
      path: { course_module_id: courseModuleId },
    }),
    refetchInterval: (latestQuery) => {
      const registration = latestQuery.state.data?.registration
      if (!registration?.status_is_moving) {
        return false
      }
      return registration.student_facing_status === "waiting_for_sisu"
        ? WAITING_FOR_SISU_REFETCH_INTERVAL_MS
        : MOVING_REFETCH_INTERVAL_MS
    },
  })

  return (
    <div className={pageCss}>
      <div className={headerCss}>
        <h1>{t("heading-credit-registration")}</h1>
        <h2>{heading}</h2>
        {typeof ectsCredits === "number" ? <p>{t("credits-n-ects", { n: ectsCredits })}</p> : null}
      </div>
      <QueryResult query={query} treatNullAsEmpty emptyFallback={<NotInThePipelineYet />}>
        {(data) =>
          data ? (
            <>
              <LiveRegistration registration={data.registration} />
              {data.earlier_attempts.length > 0 ? (
                <div className={attemptsCss}>
                  <h3>{t("heading-earlier-attempts")}</h3>
                  {data.earlier_attempts.map((attempt) => (
                    <EarlierAttempt key={attempt.id} attempt={attempt} />
                  ))}
                </div>
              ) : null}
            </>
          ) : null
        }
      </QueryResult>
    </div>
  )
}

const NotInThePipelineYet: React.FC = () => {
  const { t } = useTranslation()
  return <Infobox>{t("credit-registration-not-in-the-pipeline-yet")}</Infobox>
}

const LiveRegistration: React.FC<{ registration: MyCreditRegistration }> = ({ registration }) => {
  const { t, i18n } = useTranslation()
  const status = registration.student_facing_status
  const state = registrationStatusState(status)
  const errorHelp = registrationErrorHelp(t, registration.error_code)

  const giveConsent = useSetCreditRegistrationConsent()
  const recheckEnrolment = useRequestEnrolmentRecheck()

  const details = [
    ...(registration.registered_at
      ? [
          {
            label: t("label-registered-at"),
            value: new Date(registration.registered_at).toLocaleDateString(i18n.language),
          },
        ]
      : []),
    ...(registration.enrolment_realisation_name
      ? [
          {
            label: t("label-enrolment"),
            value: registration.enrolment_realisation_name,
          },
        ]
      : []),
  ]

  return (
    <>
      <RegistrationStatusBadge state={state}>
        {registrationStatusLabel(t, status)}
      </RegistrationStatusBadge>
      <RegistrationStatusStepper
        steps={registrationStepperSteps(t, status)}
        aria-label={t("credit-registration-progress")}
      />
      <Infobox tone={state === "action-needed" || state === "failed" ? TONE.WARNING : TONE.INFO}>
        <div className={infoboxBodyCss}>
          <p>
            {registrationExplanation(t, status, registration.consent_withdrawn_while_in_flight)}
          </p>
          {/* Otherwise raising a grade and seeing "registered" unchanged reads as a lost submission. */}
          {registration.registry_already_held_equal_or_better ? (
            <p>{t("credit-registration-explanation-not-improved")}</p>
          ) : null}
          {errorHelp ? <p>{errorHelp}</p> : null}
          {status === "needs_student_number" ? (
            <LinkingEmailLine linkingEmail={registration.linking_email} />
          ) : null}
          <NotificationEmailLine notificationEmail={registration.notification_email} />
        </div>
      </Infobox>
      {details.length > 0 ? <DescriptionList items={details} /> : null}
      <div className={actionsCss}>
        {status === "needs_consent" ? (
          <Button
            variant="primary"
            size="medium"
            isLoading={giveConsent.isPending}
            onClick={() =>
              giveConsent.mutate({ courseId: registration.course_id, consentGiven: true })
            }
          >
            {t("credit-registration-action-give-consent")}
          </Button>
        ) : null}
        {status === "needs_student_number" ? (
          <Link
            href={userSettingsStudentNumberRoute()}
            styledAsButton
            variant="primary"
            size="medium"
          >
            {t("credit-registration-action-link-student-number")}
          </Link>
        ) : null}
        {status === "needs_enrolment" ? (
          <>
            {registration.enrolment_link ? (
              <Link
                href={registration.enrolment_link}
                styledAsButton
                variant="primary"
                size="medium"
              >
                {t("credit-registration-action-enrol")}
              </Link>
            ) : null}
            <Button
              variant="secondary"
              size="medium"
              disabled={!registration.can_request_enrolment_recheck}
              isLoading={recheckEnrolment.isPending}
              onClick={() => recheckEnrolment.mutate(registration)}
            >
              {t("credit-registration-action-recheck-enrolment")}
            </Button>
          </>
        ) : null}
        <Link href={profileCreditRegistrationRoute()}>
          {t("credit-registration-see-all-my-registrations")}
        </Link>
      </div>
    </>
  )
}

const EarlierAttempt: React.FC<{ attempt: MyCreditRegistration }> = ({ attempt }) => {
  const { t } = useTranslation()
  const status = attempt.student_facing_status
  return (
    <div className={actionsCss}>
      <RegistrationStatusBadge state={registrationStatusState(status)}>
        {registrationStatusLabel(t, status)}
      </RegistrationStatusBadge>
      <span>
        {t("credit-registration-earlier-attempt-summary", {
          attempt: attempt.attempt_number,
          grade: registrationGradeLabel(t, attempt.grade_id, attempt.grade_scale_id),
        })}
      </span>
    </div>
  )
}

export default CreditRegistrationStatus
