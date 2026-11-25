"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS, QUIET_REFRESH } from "@/components/credit-registration/constants"
import {
  registrationGradeLabel,
  registrationStatusLabel,
} from "@/components/credit-registration/creditRegistrationCopy"
import {
  type CertificateOffer,
  type CreditRegistrationSubject,
  myEnrolmentRouteOptions,
  myRegistrationForSubjectOptions,
} from "@/components/credit-registration/creditRegistrationSubject"
import { RegistrationStepper } from "@/components/credit-registration/stepper/RegistrationStepper"
import type {
  CreditCourse,
  StepperCourse,
} from "@/components/credit-registration/stepper/stepperView"
import {
  bandCss,
  cardTitleBandCss,
  noteCss,
  pageTitleCss,
  sectionsCss,
  subheadingCss,
} from "@/components/credit-registration/styles"
import { getMyVerifiedStudentNumberOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  MyCreditRegistration,
  MyCreditRegistrationForSubject,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import { type QueryTuple, QueryResults } from "@/shared-module/components"

export interface CreditRegistrationStatusProps {
  subject: CreditRegistrationSubject
  courseName: string
  /** `null` on the course's default module and on a mooc.fi completion. */
  moduleName: string | null | undefined
  /** What the module is configured to be worth now, which a past registration may not match. */
  ectsCredits: number | null | undefined
  /** What the student is told while the completion has no registration yet. */
  statusBeforeRegistration: StudentFacingCreditRegistrationStatus
  /** Set when a certificate could serve instead, which asks the detour questions first. */
  certificate: CertificateOffer | null
  /** The Sisu course to enrol on, known before the registration exists. */
  uhCourseCode: string | null | undefined
  /** Where an Open University student enrols, known before the registration exists. */
  enrolmentLink: string | null | undefined
  /** Shown in the title band when the page signed the student in on their behalf. */
  signedInEmail?: string | undefined
  /**
   * Every course of a completion that earns several, each registered on its own; `subject` and the
   * single-course props above are then the first course's. Leave out for a completion that earns
   * one course.
   */
  courses?: readonly CreditCourse[]
}

const MOVING_REFETCH_INTERVAL_MS = 10_000
/** Sisu answers on its own schedule, so polling it hard buys nothing. */
const WAITING_FOR_SISU_REFETCH_INTERVAL_MS = 60_000
/** A waiting row changes only once a check finds the enrolment; a minute is soon enough. */
const WAITING_FOR_ENROLMENT_REFETCH_INTERVAL_MS = 60_000

/** How often to poll a registration, as `refetchInterval` takes it. */
const registrationRefetchInterval = (
  isRegistrationComing: boolean,
  latest: { data: MyCreditRegistrationForSubject | null | undefined; status: string },
): number | false => {
  const registration = latest.data?.registration
  if (!registration) {
    return isRegistrationComing && latest.status === "success" ? MOVING_REFETCH_INTERVAL_MS : false
  }
  if (registration.student_facing_status === "needs_enrolment") {
    return WAITING_FOR_ENROLMENT_REFETCH_INTERVAL_MS
  }
  if (!registration.status_is_moving) {
    return false
  }
  return registration.student_facing_status === "waiting_for_sisu"
    ? WAITING_FOR_SISU_REFETCH_INTERVAL_MS
    : MOVING_REFETCH_INTERVAL_MS
}

/** The stepper for one completion, with its earlier attempts; the page around it is the caller's. */
const CreditRegistrationStatus: React.FC<CreditRegistrationStatusProps> = (props) =>
  props.courses && props.courses.length > 1 ? (
    <SeveralCoursesStatus {...props} courses={props.courses} />
  ) : (
    <OneCourseStatus {...props} />
  )

const OneCourseStatus: React.FC<CreditRegistrationStatusProps> = ({
  subject,
  courseName,
  moduleName,
  ectsCredits,
  statusBeforeRegistration,
  certificate,
  uhCourseCode,
  enrolmentLink,
  signedInEmail,
}) => {
  const isRegistrationComing = statusBeforeRegistration !== "not_registering"
  const query = useQuery({
    ...myRegistrationForSubjectOptions(subject),
    // Returning to the tab, say after enrolling elsewhere, shows where things stand now.
    refetchOnWindowFocus: true,
    refetchInterval: (latestQuery) =>
      registrationRefetchInterval(isRegistrationComing, latestQuery.state),
  })
  const routeQuery = useQuery({
    ...myEnrolmentRouteOptions(subject),
    refetchOnWindowFocus: true,
  })
  const numberQuery = useQuery({
    ...getMyVerifiedStudentNumberOptions(),
    refetchOnWindowFocus: true,
  })

  const checkedAt = query.dataUpdatedAt === 0 ? null : new Date(query.dataUpdatedAt).toISOString()

  // Awaits all three: which page shows, and how many steps there are, follow from them together.
  return (
    <QueryResults
      queries={[query, routeQuery, numberQuery] as const}
      treatEmptyAsData
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionsCss}
      renderData={([data, enrolmentRoute, verifiedNumber]) => (
        <RegistrationStepper
          subject={subject}
          heading={
            <CardHeading
              courseName={courseName}
              moduleName={moduleName}
              ectsCredits={ectsCredits}
              signedInEmail={signedInEmail}
            />
          }
          courseName={courseName}
          moduleName={moduleName}
          ectsCredits={ectsCredits}
          registration={data?.registration ?? null}
          statusBeforeRegistration={statusBeforeRegistration}
          enrolmentRoute={enrolmentRoute ?? null}
          verifiedNumber={verifiedNumber ?? null}
          certificate={certificate}
          uhCourseCode={uhCourseCode}
          enrolmentLink={enrolmentLink}
          checkedAt={checkedAt}
        >
          <EarlierAttempts attempts={data?.earlier_attempts ?? []} />
        </RegistrationStepper>
      )}
    />
  )
}

/**
 * The stepper for a completion that earns several courses: each course's registration and answers
 * are read on their own, and the stepper shows them together.
 */
const SeveralCoursesStatus: React.FC<
  CreditRegistrationStatusProps & { courses: readonly CreditCourse[] }
> = ({
  courseName,
  ectsCredits,
  statusBeforeRegistration,
  certificate,
  signedInEmail,
  courses,
}) => {
  const isRegistrationComing = statusBeforeRegistration !== "not_registering"
  const registrationQueries = useQueries({
    queries: courses.map((course) => ({
      ...myRegistrationForSubjectOptions(course.subject),
      refetchOnWindowFocus: true,
      refetchInterval: (latestQuery: {
        state: { data: MyCreditRegistrationForSubject | null | undefined; status: string }
      }) => registrationRefetchInterval(isRegistrationComing, latestQuery.state),
    })),
  })
  const routeQueries = useQueries({
    queries: courses.map((course) => ({
      ...myEnrolmentRouteOptions(course.subject),
      refetchOnWindowFocus: true,
    })),
  })
  const numberQuery = useQuery({
    ...getMyVerifiedStudentNumberOptions(),
    refetchOnWindowFocus: true,
  })
  const checkedAt = latestUpdate(registrationQueries.map((query) => query.dataUpdatedAt))

  return (
    <QueryResults
      queries={([] as QueryTuple).concat(registrationQueries, routeQueries, [numberQuery])}
      treatEmptyAsData
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionsCss}
      renderData={() => {
        const stepperCourses: StepperCourse[] = courses.map((course, index) => ({
          ...course,
          registration: registrationQueries[index]?.data?.registration ?? null,
          enrolmentRoute: routeQueries[index]?.data ?? null,
        }))
        // The answers shown are those of a course that can still change them, which every save
        // writes to; once every enrolment has been seen, any course's will do.
        const answerSource =
          stepperCourses.find((course) => course.enrolmentRoute?.can_change !== false) ??
          stepperCourses[0]
        // The registry listing any course is what ends the student's steps.
        const shownRegistration =
          stepperCourses.find((course) => course.registration?.linking_email)?.registration ??
          answerSource?.registration ??
          null
        if (!answerSource) {
          return null
        }
        return (
          <RegistrationStepper
            subject={answerSource.subject}
            heading={
              <CardHeading
                courseName={courseName}
                moduleName={null}
                ectsCredits={ectsCredits}
                signedInEmail={signedInEmail}
              />
            }
            courseName={courseName}
            moduleName={null}
            ectsCredits={ectsCredits}
            registration={shownRegistration}
            statusBeforeRegistration={statusBeforeRegistration}
            enrolmentRoute={answerSource.enrolmentRoute}
            verifiedNumber={numberQuery.data ?? null}
            certificate={certificate}
            uhCourseCode={answerSource.uhCourseCode}
            enrolmentLink={answerSource.enrolmentLink}
            checkedAt={checkedAt}
            courses={stepperCourses}
          >
            <EarlierAttempts
              attempts={registrationQueries.flatMap((query) => query.data?.earlier_attempts ?? [])}
            />
          </RegistrationStepper>
        )
      }}
    />
  )
}

const latestUpdate = (updatedAts: number[]): string | null => {
  const latest = Math.max(0, ...updatedAts)
  return latest === 0 ? null : new Date(latest).toISOString()
}

/** The card's title band: which credits the page is about. An empty `courseName` leaves it out. */
export const CardHeading: React.FC<{
  courseName: string
  moduleName: string | null | undefined
  ectsCredits: number | null | undefined
  signedInEmail?: string | undefined
}> = ({ courseName, moduleName, ectsCredits, signedInEmail }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <header className={cardTitleBandCss}>
      <h1 className={pageTitleCss}>{t("register-completion")}</h1>
      {courseName ? (
        <p className={subheadingCss}>
          {t("course")}:{" "}
          {moduleName
            ? t("credit-registration-course-and-module", { course: courseName, module: moduleName })
            : courseName}
        </p>
      ) : null}
      {typeof ectsCredits === "number" ? (
        <p className={noteCss}>{t("credits-n-ects", { count: ectsCredits, n: ectsCredits })}</p>
      ) : null}
      {signedInEmail ? (
        <p className={noteCss}>{t("credit-registration-signed-in-as", { email: signedInEmail })}</p>
      ) : null}
    </header>
  )
}

/** Replaced and older attempts, each with where it got to. */
const EarlierAttempts: React.FC<{ attempts: MyCreditRegistration[] }> = ({ attempts }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (attempts.length === 0) {
    return null
  }
  return (
    <section className={bandCss}>
      <h2 className={subheadingCss}>{t("heading-earlier-attempts")}</h2>
      {attempts.map((attempt) => {
        const summary = {
          attempt: attempt.attempt_number,
          grade: registrationGradeLabel(t, attempt.grade_id, attempt.grade_scale_id),
        }
        return (
          <p key={attempt.id} className={noteCss}>
            {/* A replaced attempt keeps the state it reached, which reads as still held. */}
            {attempt.superseded
              ? t("credit-registration-earlier-attempt-summary", summary)
              : t("credit-registration-earlier-attempt-summary-with-status", {
                  ...summary,
                  status: registrationStatusLabel(t, attempt.student_facing_status),
                })}
          </p>
        )
      })}
    </section>
  )
}

export default CreditRegistrationStatus
