"use client"

import { css } from "@emotion/css"
import { announce } from "@react-aria/live-announcer"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "@vectopus/atlas-icons-react"
import { useSearchParams } from "next/navigation"
import React, { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import {
  CREDIT_REGISTRATION_NS,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_DATE,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import {
  registrationGradeLabel,
  registrationStatusLabel,
} from "@/components/credit-registration/creditRegistrationCopy"
import { EnrolmentRouteStep } from "@/components/credit-registration/EnrolmentRouteStep"
import {
  isPreviewState,
  PREVIEW_STATE_PARAM,
  previewPage,
} from "@/components/credit-registration/previewRegistration"
import {
  RegistrationActions,
  type RegistrationCardAction,
} from "@/components/credit-registration/RegistrationStatusCard"
import { StudentNumberLinkStep } from "@/components/credit-registration/StudentNumberLinkStep"
import {
  CONFIRM_EMAIL_ACTION_KEY,
  RECHECK_ENROLMENT_ACTION_KEY,
  useStudentRegistrationActions,
} from "@/components/credit-registration/studentRegistrationActions"
import { StudentRegistrationExplanation } from "@/components/credit-registration/StudentRegistrationExplanation"
import {
  bandCss,
  bandedCardCss,
  cardTitleBandCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  sectionsCss,
  subheadingCss,
} from "@/components/credit-registration/styles"
import {
  asksWhereYouEnrolled,
  isWaitingForEnrolment,
  saysWhatIsHappening,
  showsRegistrationFacts,
} from "@/components/credit-registration/trackerView"
import { useCanConfirmEmailAddress } from "@/components/credit-registration/useCanConfirmEmailAddress"
import {
  getMyCreditRegistrationForCourseModuleOptions,
  getMyEnrolmentRouteOptions,
  getMyVerifiedStudentNumberOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
} from "@/generated/api/types.generated"
import { profileStudiesRoute } from "@/shared-module/common/utils/routes"
import {
  DescriptionList,
  Infobox,
  Link,
  QueryResult,
  RelativeTime,
} from "@/shared-module/components"

export interface CreditRegistrationStatusProps {
  courseModuleId: string
  courseName: string
  /** `null` on the course's default module. */
  moduleName: string | null | undefined
  /** What the module is configured to be worth now, which a past registration may not match. */
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
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const previewParam = useSearchParams()?.get(PREVIEW_STATE_PARAM) ?? null
  const preview = isPreviewState(previewParam) ? previewPage(previewParam) : null

  const query = useQuery({
    ...getMyCreditRegistrationForCourseModuleOptions({
      path: { course_module_id: courseModuleId },
    }),
    enabled: preview === null,
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
  const routeQuery = useQuery({
    ...getMyEnrolmentRouteOptions({ path: { course_module_id: courseModuleId } }),
    enabled: preview === null,
  })
  const numberQuery = useQuery({
    ...getMyVerifiedStudentNumberOptions(),
    enabled: preview === null,
  })

  const data = preview ? preview.registration : (query.data ?? null)
  const enrolmentRoute = preview ? preview.enrolmentRoute : (routeQuery.data ?? null)
  const verifiedNumber = preview ? preview.verifiedStudentNumber : (numberQuery.data ?? null)

  const body = data ? (
    <Tracker
      courseModuleId={courseModuleId}
      courseName={courseName}
      moduleName={moduleName}
      ectsCredits={ectsCredits}
      registration={data.registration}
      enrolmentRoute={enrolmentRoute}
      verifiedNumber={verifiedNumber}
      checkedAt={query.dataUpdatedAt === 0 ? null : new Date(query.dataUpdatedAt).toISOString()}
      earlierAttempts={data.earlier_attempts}
    />
  ) : null

  return (
    <div className={narrowPageCss}>
      <div>
        <Link href={profileStudiesRoute()} className={backLinkCss}>
          <ArrowLeft size={BACK_ARROW_SIZE} aria-hidden="true" />
          {t("heading-my-studies")}
        </Link>
      </div>
      {preview ? (
        <div className={sectionsCss}>{body}</div>
      ) : (
        <QueryResult
          query={query}
          treatNullAsEmpty
          refreshIndicator={QUIET_REFRESH}
          emptyFallback={<NotInThePipelineYet />}
          contentClassName={sectionsCss}
        >
          {() => body}
        </QueryResult>
      )}
    </div>
  )
}

const CONTACT_SUPPORT = "contact-support"

/** Drops the mail-your-support-inbox lever, which this page does not offer. */
const withoutSupportMail = (
  action: RegistrationCardAction | null,
): RegistrationCardAction | null => (action?.key === CONTACT_SUPPORT ? null : action)

const NotInThePipelineYet: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return <Infobox tone={TONE.NEUTRAL}>{t("credit-registration-not-in-the-pipeline-yet")}</Infobox>
}

interface TrackerProps {
  courseModuleId: string
  courseName: string
  moduleName: string | null | undefined
  ectsCredits: number | null | undefined
  registration: MyCreditRegistration
  enrolmentRoute: MyEnrolmentRoute | null
  verifiedNumber: MyVerifiedStudentNumber | null
  checkedAt: string | null
  earlierAttempts: MyCreditRegistration[]
}

/**
 * One card showing only where the registration stands right now.
 *
 * Never a checklist. Steps still to come would have the student reading about work they cannot
 * affect, and steps already behind them stay on screen only while their own answers can still
 * change something: once an enrolment exists the page is about the registration, and once the
 * credits are in Sisu it is about the credits.
 */
const Tracker: React.FC<TrackerProps> = ({
  courseModuleId,
  courseName,
  moduleName,
  ectsCredits,
  registration,
  enrolmentRoute,
  verifiedNumber,
  checkedAt,
  earlierAttempts,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const status = registration.student_facing_status
  const statusLabel = registrationStatusLabel(t, status)
  const canConfirmEmail = useCanConfirmEmailAddress()
  const actions = useStudentRegistrationActions({
    registration,
    canConfirmEmail,
    linkToStatusPage: false,
  })
  // This page never sends a student to their mail client: whatever is wrong, it is either something
  // they can do here or something we are already dealing with.
  const primaryAction = withoutSupportMail(actions.primaryAction)
  const secondaryActions = actions.secondaryActions.filter(
    (action) => withoutSupportMail(action) !== null,
  )

  // The page polls, so a status that moves while it is open has to be announced, not only redrawn.
  const announcedStatus = useRef(status)
  useEffect(() => {
    if (announcedStatus.current !== status) {
      announcedStatus.current = status
      announce(t("credit-registration-status-is-now", { status: statusLabel }))
    }
  }, [status, statusLabel, t])

  const view = { registration, enrolmentRoute }
  const leverByKey = (key: string): RegistrationCardAction | null =>
    [primaryAction, ...secondaryActions].find((action) => action?.key === key) ?? null

  return (
    <>
      <article className={bandedCardCss}>
        <header className={cardTitleBandCss}>
          <h1 className={pageTitleCss}>{t("register-completion")}</h1>
          <p className={subheadingCss}>
            {t("course")}: {moduleName ? `${courseName}${MIDDLE_DOT}${moduleName}` : courseName}
          </p>
          {typeof ectsCredits === "number" ? (
            <p className={noteCss}>{t("credits-n-ects", { n: ectsCredits })}</p>
          ) : null}
        </header>

        <StudentNumberLinkStep
          registration={registration}
          verifiedNumber={verifiedNumber}
          confirmEmailAction={leverByKey(CONFIRM_EMAIL_ACTION_KEY)}
        />

        {asksWhereYouEnrolled(view) && enrolmentRoute ? (
          <EnrolmentRouteStep
            courseModuleId={courseModuleId}
            enrolmentRoute={enrolmentRoute}
            openUniversityEnrolmentLink={registration.enrolment_link}
          />
        ) : null}

        {isWaitingForEnrolment(view) ? (
          <WaitingForEnrolment
            registration={registration}
            // Only this lever: the plan's other one sends the student off to the open university,
            // under a band where half of them have just said they enrolled through Sisu.
            recheckAction={leverByKey(RECHECK_ENROLMENT_ACTION_KEY)}
          />
        ) : null}

        {saysWhatIsHappening(view) ? (
          <section className={bandCss}>
            <h2 className={subheadingCss}>{statusLabel}</h2>
            <StudentRegistrationExplanation registration={registration} />
            <RegistrationActions
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
            />
            {showsRegistrationFacts(registration) ? (
              <RegistrationFacts
                registration={registration}
                verifiedNumber={verifiedNumber}
                moduleEctsCredits={ectsCredits}
              />
            ) : null}
            {registration.status_is_moving && checkedAt ? (
              <p className={noteCss}>
                {t("credit-registration-last-checked")}{" "}
                <RelativeTime at={checkedAt} absoluteTime={TIME_IN_TITLE} />{" "}
                {t("credit-registration-checks-again-automatically")}
              </p>
            ) : null}
          </section>
        ) : null}
      </article>

      {earlierAttempts.length > 0 ? (
        <section className={bandCss}>
          <h2 className={subheadingCss}>{t("heading-earlier-attempts")}</h2>
          {earlierAttempts.map((attempt) => (
            <p key={attempt.id} className={noteCss}>
              {t("credit-registration-earlier-attempt-summary", {
                attempt: attempt.attempt_number,
                grade: registrationGradeLabel(t, attempt.grade_id, attempt.grade_scale_id),
              })}
            </p>
          ))}
        </section>
      ) : null}
    </>
  )
}

/**
 * The wait between the student enrolling and the enrolment appearing in the University's records.
 *
 * Says the expectation before anything else, because the pipeline reaches "not there yet" within
 * minutes of the student pressing the button, and a student reading that as a verdict concludes
 * something is broken when nothing is.
 */
const WaitingForEnrolment: React.FC<{
  registration: MyCreditRegistration
  recheckAction: RegistrationCardAction | null
}> = ({ registration, recheckAction }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <section className={bandCss}>
      <h2 className={subheadingCss}>{t("credit-registration-waiting-for-enrolment-heading")}</h2>
      <p>{t("credit-registration-waiting-for-enrolment-body")}</p>
      <RegistrationActions primaryAction={recheckAction} />
      {registration.enrolment_checked_at ? (
        <p className={noteCss}>
          {t("credit-registration-last-looked")}{" "}
          <RelativeTime at={registration.enrolment_checked_at} absoluteTime={TIME_IN_TITLE} />
        </p>
      ) : null}
    </section>
  )
}

/** The transcript facts: what was registered, under which number, and to whom. */
const RegistrationFacts: React.FC<{
  registration: MyCreditRegistration
  verifiedNumber: MyVerifiedStudentNumber | null
  moduleEctsCredits: number | null | undefined
}> = ({ registration, verifiedNumber, moduleEctsCredits }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const credits = registration.credits ?? moduleEctsCredits
  // The number frozen on the row is not always the account's link now, so the name only belongs
  // beside a number the link still covers.
  const nameInRegistry =
    verifiedNumber && verifiedNumber.student_number === registration.student_number
      ? [verifiedNumber.first_names, verifiedNumber.last_name].filter(Boolean).join(" ")
      : ""

  if (!registration.registered_at) {
    return null
  }
  const items = [
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
      ? [{ label: t("label-student-number"), value: registration.student_number }]
      : []),
    ...(nameInRegistry
      ? [{ label: t("label-name-in-university-records"), value: nameInRegistry }]
      : []),
  ]

  const wasRegisteredAtAnotherAmount =
    typeof registration.credits === "number" &&
    typeof moduleEctsCredits === "number" &&
    registration.credits !== moduleEctsCredits

  return (
    <>
      <DescriptionList items={items} />
      {wasRegisteredAtAnotherAmount ? (
        <p className={noteCss}>
          {registration.course_module_name
            ? t("credit-registration-module-credits-differ-from-current", {
                current: moduleEctsCredits,
              })
            : t("credit-registration-course-credits-differ-from-current", {
                current: moduleEctsCredits,
              })}
        </p>
      ) : null}
    </>
  )
}

export default CreditRegistrationStatus
