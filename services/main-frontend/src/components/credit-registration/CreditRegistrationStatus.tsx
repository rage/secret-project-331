"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS, QUIET_REFRESH } from "@/components/credit-registration/constants"
import {
  registrationGradeLabel,
  registrationStatusLabel,
} from "@/components/credit-registration/creditRegistrationCopy"
import type {
  CertificateOffer,
  CreditRegistrationSubject,
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
import {
  getMyCreditRegistrationForCourseModuleOptions,
  getMyEnrolmentRouteOptions,
  getMyMoocfiCompletionRegistrationOptions,
  getMyVerifiedStudentNumberOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  MyCreditRegistration,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import { QueryResults } from "@/shared-module/components"

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
  /** Every course a mooc.fi completion registers under; leave out for a module's. */
  courses?: readonly CreditCourse[]
}

const MOVING_REFETCH_INTERVAL_MS = 10_000
/** Sisu answers on its own schedule, so polling it hard buys nothing. */
const WAITING_FOR_SISU_REFETCH_INTERVAL_MS = 60_000
/** A waiting row changes only once a check finds the enrolment; a minute is soon enough. */
const WAITING_FOR_ENROLMENT_REFETCH_INTERVAL_MS = 60_000

/** How often one registration needs polling; `null` before the pipeline has created it. */
const registrationRefetchInterval = (
  isRegistrationComing: boolean,
  registration: MyCreditRegistration | null,
): number | false => {
  if (!registration) {
    return isRegistrationComing ? MOVING_REFETCH_INTERVAL_MS : false
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

/** How often to poll registrations read together, as `refetchInterval` takes it. */
const refetchInterval = (
  isRegistrationComing: boolean,
  registrations: readonly (MyCreditRegistration | null)[],
  status: string,
): number | false => {
  const intervals = registrations
    .map((registration) =>
      registrationRefetchInterval(isRegistrationComing && status === "success", registration),
    )
    .filter((interval) => interval !== false)
  return intervals.length === 0 ? false : Math.min(...intervals)
}

/** The stepper for one completion, with its earlier attempts; the page around it is the caller's. */
const CreditRegistrationStatus: React.FC<CreditRegistrationStatusProps> = (props) =>
  props.subject.kind === "course_module" ? (
    <ModuleStatus {...props} courseModuleId={props.subject.courseModuleId} />
  ) : (
    <MoocfiStatus {...props} moocfiCompletionId={props.subject.moocfiCompletionId} />
  )

const ModuleStatus: React.FC<CreditRegistrationStatusProps & { courseModuleId: string }> = ({
  subject,
  courseModuleId,
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
  const path = { course_module_id: courseModuleId }
  const query = useQuery({
    ...getMyCreditRegistrationForCourseModuleOptions({ path }),
    // Returning to the tab, say after enrolling elsewhere, shows where things stand now.
    refetchOnWindowFocus: true,
    refetchInterval: (latest) =>
      refetchInterval(
        isRegistrationComing,
        latest.state.data === undefined ? [] : [latest.state.data?.registration ?? null],
        latest.state.status,
      ),
  })
  const routeQuery = useQuery({
    ...getMyEnrolmentRouteOptions({ path }),
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

/** The stepper for a mooc.fi completion, which reads every course code's registration at once. */
const MoocfiStatus: React.FC<CreditRegistrationStatusProps & { moocfiCompletionId: string }> = ({
  subject,
  moocfiCompletionId,
  courseName,
  ectsCredits,
  statusBeforeRegistration,
  certificate,
  uhCourseCode,
  enrolmentLink,
  signedInEmail,
  courses = [],
}) => {
  const isRegistrationComing = statusBeforeRegistration !== "not_registering"
  const query = useQuery({
    ...getMyMoocfiCompletionRegistrationOptions({
      path: { moocfi_completion_id: moocfiCompletionId },
    }),
    refetchOnWindowFocus: true,
    refetchInterval: (latest) =>
      refetchInterval(
        isRegistrationComing,
        latest.state.data?.codes.map((code) => code.registration ?? null) ?? [],
        latest.state.status,
      ),
  })
  const numberQuery = useQuery({
    ...getMyVerifiedStudentNumberOptions(),
    refetchOnWindowFocus: true,
  })
  const checkedAt = query.dataUpdatedAt === 0 ? null : new Date(query.dataUpdatedAt).toISOString()

  return (
    <QueryResults
      queries={[query, numberQuery] as const}
      treatEmptyAsData
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionsCss}
      renderData={([data, verifiedNumber]) => {
        const codes = new Map(data.codes.map((code) => [code.external_completion_id, code]))
        const stepperCourses: StepperCourse[] = courses.map((course) => ({
          ...course,
          registration: codes.get(course.key)?.registration ?? null,
          enrolmentRoute: codes.get(course.key)?.enrolment_route ?? null,
        }))
        return (
          <RegistrationStepper
            subject={subject}
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
            registration={data.registration ?? null}
            statusBeforeRegistration={statusBeforeRegistration}
            enrolmentRoute={data.enrolment_route}
            verifiedNumber={verifiedNumber ?? null}
            certificate={certificate}
            uhCourseCode={uhCourseCode}
            enrolmentLink={enrolmentLink}
            checkedAt={checkedAt}
            courses={stepperCourses}
          >
            <EarlierAttempts attempts={data.earlier_attempts} />
          </RegistrationStepper>
        )
      }}
    />
  )
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
