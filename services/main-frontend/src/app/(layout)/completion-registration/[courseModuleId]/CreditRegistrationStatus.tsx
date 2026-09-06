"use client"

import { css } from "@emotion/css"
import { announce } from "@react-aria/live-announcer"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "@vectopus/atlas-icons-react"
import React, { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import {
  MIDDLE_DOT,
  QUIET_REFRESH,
  SUPPORT_MAIL_INLINE,
  TIME_DATE,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import {
  registrationGradeLabel,
  registrationStatusLabel,
  registrationStatusState,
} from "@/components/credit-registration/creditRegistrationCopy"
import RegistrationStatusCard from "@/components/credit-registration/RegistrationStatusCard"
import { useStudentRegistrationActions } from "@/components/credit-registration/studentRegistrationActions"
import { StudentRegistrationExplanation } from "@/components/credit-registration/StudentRegistrationExplanation"
import { registrationSupportMail } from "@/components/credit-registration/studentSupportMail"
import {
  monospaceCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  rowCss,
  sectionsCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import SupportMailLink from "@/components/credit-registration/SupportMailLink"
import { useCanConfirmEmailAddress } from "@/components/credit-registration/useCanConfirmEmailAddress"
import {
  getMyCreditRegistrationForCourseModuleOptions,
  getMyVerifiedStudentNumberOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration } from "@/generated/api/types.generated"
import {
  profileStudiesRoute,
  userSettingsStudentNumberRoute,
} from "@/shared-module/common/utils/routes"
import {
  DescriptionList,
  Infobox,
  Link,
  QueryResult,
  RegistrationStatusBadge,
  RelativeTime,
} from "@/shared-module/components"

export interface CreditRegistrationStatusProps {
  courseModuleId: string
  courseName: string
  /** `null` on the course's default module. */
  moduleName: string | null | undefined
  /** What the part is configured to be worth now, which a past registration may not match. */
  ectsCredits: number | null | undefined
}

const MOVING_REFETCH_INTERVAL_MS = 10_000
/** Sisu answers on its own schedule, so polling it hard buys nothing. */
const WAITING_FOR_SISU_REFETCH_INTERVAL_MS = 60_000

const BACK_ARROW_SIZE = 16

const backLinkCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
`

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
      <div>
        <Link href={profileStudiesRoute()} className={backLinkCss}>
          <ArrowLeft size={BACK_ARROW_SIZE} aria-hidden="true" />
          {t("heading-my-studies")}
        </Link>
      </div>
      {/* The page's subject; the coloured headline below it is the answer. */}
      <h1 className={pageTitleCss}>{heading}</h1>
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
                moduleEctsCredits={ectsCredits}
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
    </div>
  )
}

const NotInThePipelineYet: React.FC = () => {
  const { t } = useTranslation()
  return <Infobox tone={TONE.NEUTRAL}>{t("credit-registration-not-in-the-pipeline-yet")}</Infobox>
}

const LiveRegistration: React.FC<{
  registration: MyCreditRegistration
  checkedAt: string
  moduleEctsCredits: number | null | undefined
}> = ({ registration, checkedAt, moduleEctsCredits }) => {
  const { t } = useTranslation()
  const status = registration.student_facing_status
  const state = registrationStatusState(status)
  const statusLabel = registrationStatusLabel(t, status)
  const canConfirmEmail = useCanConfirmEmailAddress()
  const { primaryAction, secondaryActions, supportMail } = useStudentRegistrationActions({
    registration,
    canConfirmEmail,
    linkToStatusPage: false,
  })

  // The page polls, so a status that moves while it is open has to be announced, not only redrawn.
  const announcedStatus = useRef(status)
  useEffect(() => {
    if (announcedStatus.current !== status) {
      announcedStatus.current = status
      announce(t("credit-registration-status-is-now", { status: statusLabel }))
    }
  }, [status, statusLabel, t])

  return (
    <RegistrationStatusCard
      state={state}
      headline={statusLabel}
      explanation={<StudentRegistrationExplanation registration={registration} />}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      meta={
        <>
          <RegistrationFacts registration={registration} moduleEctsCredits={moduleEctsCredits} />
          {status === "registered" ? (
            <p className={noteCss}>
              {t("credit-registration-registered-not-showing-in-sisu")}{" "}
              <SupportMailLink
                {...registrationSupportMail(t, registration)}
                appearance={SUPPORT_MAIL_INLINE}
                label={t("link-text-still-missing-email-support")}
              />
            </p>
          ) : supportMail ? (
            <SupportMailLink {...supportMail} />
          ) : null}
          {registration.status_is_moving ? (
            <p className={noteCss}>
              {t("credit-registration-last-checked")}{" "}
              <RelativeTime at={checkedAt} absoluteTime={TIME_IN_TITLE} />{" "}
              {t("credit-registration-checks-again-automatically")}
            </p>
          ) : null}
        </>
      }
    />
  )
}

/** The transcript facts: what was registered, under which number, and to whom. */
const RegistrationFacts: React.FC<{
  registration: MyCreditRegistration
  moduleEctsCredits: number | null | undefined
}> = ({ registration, moduleEctsCredits }) => {
  const { t } = useTranslation()
  const verifiedNumber = useQuery({ ...getMyVerifiedStudentNumberOptions() }).data
  const credits = registration.credits ?? moduleEctsCredits
  // The number frozen on the row is not always the account's link now, so the name only belongs
  // beside a number the link still covers.
  const nameInRegistry =
    verifiedNumber && verifiedNumber.student_number === registration.student_number
      ? [verifiedNumber.first_names, verifiedNumber.last_name].filter(Boolean).join(" ")
      : ""

  const items = [
    ...(registration.registered_at
      ? [
          {
            label: t("label-registered-at"),
            value: <RelativeTime at={registration.registered_at} absoluteTime={TIME_DATE} />,
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
                  value: (
                    <>
                      <span className={monospaceCss}>{registration.student_number}</span>{" "}
                      <Link href={userSettingsStudentNumberRoute()}>
                        {t("link-text-not-your-number-change-it")}
                      </Link>
                    </>
                  ),
                },
              ]
            : []),
          ...(nameInRegistry
            ? [{ label: t("label-name-in-university-records"), value: nameInRegistry }]
            : []),
        ]
      : []),
    ...(registration.enrolment_realisation_name
      ? [{ label: t("label-enrolment"), value: registration.enrolment_realisation_name }]
      : []),
  ]

  const wasRegisteredAtAnotherAmount =
    typeof registration.credits === "number" &&
    typeof moduleEctsCredits === "number" &&
    registration.credits !== moduleEctsCredits

  if (items.length === 0) {
    return null
  }
  return (
    <div className={subsectionCss}>
      <DescriptionList items={items} />
      {wasRegisteredAtAnotherAmount ? (
        <p className={noteCss}>
          {t("credit-registration-credits-differ-from-current", { current: moduleEctsCredits })}
        </p>
      ) : null}
    </div>
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
