"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import {
  registrationErrorHelp,
  registrationExplanation,
  registrationStatusLabel,
  registrationStatusState,
  registrationStepperSteps,
} from "@/components/credit-registration/creditRegistrationCopy"
import LinkingEmailLine from "@/components/credit-registration/LinkingEmailLine"
import {
  getMyCreditRegistrationForCourseModuleOptions,
  getMyCreditRegistrationForCourseModuleQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  requestCreditRegistrationEnrolmentRecheck,
  setMyCourseCreditRegistrationConsent,
} from "@/generated/api/sdk.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
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
  /** Falls back to the course name when the module has none of its own. */
  heading: string
  ectsCredits: number | null | undefined
}

/** While the pipeline still owns the row. */
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
              <LiveRegistration registration={data.registration} courseModuleId={courseModuleId} />
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

const LiveRegistration: React.FC<{
  registration: MyCreditRegistration
  courseModuleId: string
}> = ({ registration, courseModuleId }) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const status = registration.student_facing_status
  const state = registrationStatusState(status)
  const errorHelp = registrationErrorHelp(t, registration.error_code)

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: getMyCreditRegistrationForCourseModuleQueryKey({
        path: { course_module_id: courseModuleId },
      }),
    })
  }

  const giveConsent = useToastMutation<void, unknown, void>(
    async () => {
      await setMyCourseCreditRegistrationConsent({
        path: { course_id: registration.course_id },
        body: { consent_given: true },
      })
    },
    { notify: true, method: "PUT" },
    { onSuccess: invalidate },
  )

  const recheckEnrolment = useToastMutation<void, unknown, void>(
    async () => {
      await requestCreditRegistrationEnrolmentRecheck({ path: { id: registration.id } })
    },
    { notify: true, method: "POST" },
    { onSuccess: invalidate },
  )

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
          <p>{registrationExplanation(t, status, registration.state)}</p>
          {errorHelp ? <p>{errorHelp}</p> : null}
          {status === "needs_student_number" ? (
            <LinkingEmailLine linkingEmail={registration.linking_email} />
          ) : null}
        </div>
      </Infobox>
      {details.length > 0 ? <DescriptionList items={details} /> : null}
      <div className={actionsCss}>
        {status === "needs_consent" ? (
          <Button
            variant="primary"
            size="medium"
            isLoading={giveConsent.isPending}
            onClick={() => giveConsent.mutate()}
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
              onClick={() => recheckEnrolment.mutate()}
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
          grade: attempt.grade_id ?? t("unknown-grade"),
        })}
      </span>
    </div>
  )
}

export default CreditRegistrationStatus
