"use client"

import { announce } from "@react-aria/live-announcer"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useRef } from "react"
import { Trans, useTranslation } from "react-i18next"

import {
  MIDDLE_DOT,
  QUIET_REFRESH,
  SISU_URL,
  SUPPORT_EMAIL,
  TIME_COMPACT,
} from "@/components/credit-registration/constants"
import {
  registrationErrorHelp,
  registrationExplanation,
  registrationGradeLabel,
  registrationStatusLabel,
  registrationStatusState,
} from "@/components/credit-registration/creditRegistrationCopy"
import {
  LinkingEmailLine,
  NotificationEmailLine,
} from "@/components/credit-registration/EmailStatusLine"
import { useRequestEnrolmentRecheck } from "@/components/credit-registration/enrolmentActions"
import {
  monospaceCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  rowCss,
  sectionHeaderCss,
  sectionsCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import { getMyCreditRegistrationForCourseModuleOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import {
  profileStudiesRoute,
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"
import {
  Button,
  DescriptionList,
  Infobox,
  Link,
  QueryResult,
  RegistrationStatusBadge,
  RegistrationStatusHeadline,
  registrationStatusInfoboxTone,
  RelativeTime,
} from "@/shared-module/components"

// oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
const sisuLink = <a href={SISU_URL} target="_blank" rel="noopener noreferrer" />
// oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
const supportMailLink = <a href={`mailto:${SUPPORT_EMAIL}`} />

export interface CreditRegistrationStatusProps {
  courseModuleId: string
  courseName: string
  /** `null` on the course's default module. */
  moduleName: string | null | undefined
  ectsCredits: number | null | undefined
}

const MOVING_REFETCH_INTERVAL_MS = 10_000
/** Sisu answers on its own schedule, so polling it hard buys nothing. */
const WAITING_FOR_SISU_REFETCH_INTERVAL_MS = 60_000

const CreditRegistrationStatus: React.FC<CreditRegistrationStatusProps> = ({
  courseModuleId,
  courseName,
  moduleName,
  ectsCredits,
}) => {
  const { t } = useTranslation()
  const heading = moduleName ? `${courseName}${MIDDLE_DOT}${moduleName}` : courseName
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
    <div className={narrowPageCss}>
      <Link href={profileStudiesRoute()}>{t("heading-my-studies")}</Link>
      <div className={sectionHeaderCss}>
        <h1 className={pageTitleCss}>{t("heading-credit-registration")}</h1>
        <p className={noteCss}>
          {typeof ectsCredits === "number"
            ? t("course-name-and-ects", { course: heading, ects: ectsCredits })
            : heading}
        </p>
      </div>
      <QueryResult
        query={query}
        treatNullAsEmpty
        refreshIndicator={QUIET_REFRESH}
        emptyFallback={<NotInThePipelineYet />}
        contentClassName={sectionsCss}
      >
        {(data) =>
          data ? (
            <>
              <LiveRegistration
                registration={data.registration}
                checkedAt={new Date(query.dataUpdatedAt).toISOString()}
                ectsCredits={ectsCredits}
              />
              {data.earlier_attempts.length > 0 ? (
                <div className={subsectionCss}>
                  <h3 className={subheadingCss}>{t("heading-earlier-attempts")}</h3>
                  {data.earlier_attempts.map((attempt) => (
                    <EarlierAttempt key={attempt.id} attempt={attempt} />
                  ))}
                </div>
              ) : null}
            </>
          ) : null
        }
      </QueryResult>
      <p className={noteCss}>
        <Trans
          t={t}
          i18nKey="credit-registration-contact-support"
          values={{ email: SUPPORT_EMAIL }}
          components={{ mailLink: supportMailLink }}
        />
      </p>
    </div>
  )
}

const NotInThePipelineYet: React.FC = () => {
  const { t } = useTranslation()
  return <Infobox>{t("credit-registration-not-in-the-pipeline-yet")}</Infobox>
}

const LiveRegistration: React.FC<{
  registration: MyCreditRegistration
  checkedAt: string
  ectsCredits: number | null | undefined
}> = ({ registration, checkedAt, ectsCredits }) => {
  const { t } = useTranslation()
  const status = registration.student_facing_status
  const state = registrationStatusState(status)
  const errorHelp = registrationErrorHelp(t, registration.error_code)
  const statusLabel = registrationStatusLabel(t, status)

  const recheckEnrolment = useRequestEnrolmentRecheck()

  // The page polls, so a status that moves while it is open has to be announced, not only redrawn.
  const announcedStatus = useRef(status)
  useEffect(() => {
    if (announcedStatus.current !== status) {
      announcedStatus.current = status
      announce(t("credit-registration-status-is-now", { status: statusLabel }))
    }
  }, [status, statusLabel, t])

  const credits = registration.credits ?? ectsCredits
  const details = [
    ...(registration.registered_at
      ? [
          {
            label: t("label-registered-at"),
            value: <RelativeTime at={registration.registered_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            label: t("label-grade"),
            value: registrationGradeLabel(t, registration.grade_id, registration.grade_scale_id),
          },
          ...(typeof credits === "number"
            ? [{ label: t("label-credits"), value: t("ects-n", { n: credits }) }]
            : []),
          ...(registration.student_number
            ? [
                {
                  label: t("label-student-number"),
                  value: <span className={monospaceCss}>{registration.student_number}</span>,
                },
              ]
            : []),
        ]
      : []),
    ...(registration.enrolment_realisation_name
      ? [{ label: t("label-enrolment"), value: registration.enrolment_realisation_name }]
      : []),
  ]

  const attentionHeading =
    state === "failed"
      ? t("heading-what-went-wrong")
      : state === "action-needed"
        ? t("heading-what-you-need-to-do")
        : null

  const explanation = (
    <div className={subsectionCss}>
      <p>
        {errorHelp ? (
          errorHelp
        ) : status === "registered" ? (
          <Trans
            t={t}
            i18nKey="credit-registration-explanation-registered"
            components={{ sisuLink }}
          />
        ) : (
          registrationExplanation(t, status)
        )}
      </p>
      {/* Otherwise raising a grade and seeing "registered" unchanged reads as a lost submission. */}
      {registration.registry_already_held_equal_or_better ? (
        <p>{t("credit-registration-explanation-not-improved")}</p>
      ) : null}
      {status === "failed" ? <p>{t("credit-registration-failed-not-yours-to-fix")}</p> : null}
      {status === "needs_student_number" ? (
        <LinkingEmailLine linkingEmail={registration.linking_email} />
      ) : null}
      <NotificationEmailLine notificationEmail={registration.notification_email} />
    </div>
  )

  return (
    <>
      <RegistrationStatusHeadline state={state}>{statusLabel}</RegistrationStatusHeadline>
      {attentionHeading !== null ? (
        <Infobox tone={registrationStatusInfoboxTone[state]} heading={attentionHeading}>
          {explanation}
        </Infobox>
      ) : (
        explanation
      )}
      {details.length > 0 ? <DescriptionList items={details} /> : null}
      {status === "needs_enrolment" && !registration.enrolment_link ? (
        <p className={noteCss}>{t("credit-registration-no-enrolment-link-available")}</p>
      ) : null}
      {status === "needs_enrolment" ? (
        <div className={rowCss}>
          {registration.enrolment_link ? (
            <Link href={registration.enrolment_link} styledAsButton variant="primary" size="medium">
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
        </div>
      ) : null}
      {status === "needs_student_number" ? (
        <div className={rowCss}>
          <Link href={userSettingsStudentNumberRoute()}>
            {t("credit-registration-about-your-student-number")}
          </Link>
        </div>
      ) : null}
      {status === "needs_enrolment" && !registration.can_request_enrolment_recheck ? (
        <p className={noteCss}>{t("credit-registration-enrolment-checked-recently")}</p>
      ) : null}
      {registration.status_is_moving ? (
        <p className={noteCss}>
          {t("credit-registration-last-checked")}{" "}
          <RelativeTime at={checkedAt} absoluteTime={TIME_COMPACT} />
        </p>
      ) : null}
    </>
  )
}

const EarlierAttempt: React.FC<{ attempt: MyCreditRegistration }> = ({ attempt }) => {
  const { t } = useTranslation()
  const status = attempt.student_facing_status
  return (
    <div className={rowCss}>
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
