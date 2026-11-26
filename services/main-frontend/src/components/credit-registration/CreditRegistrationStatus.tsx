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
  noteCss,
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
  /** The course the completion is of; the card names the course instead when there is only one. */
  courseName: string
  /** `null` on the course's default module and on a mooc.fi completion. */
  moduleName: string | null | undefined
  /** Every course the completion earns, each registered on its own; a module earns one. */
  courses: readonly [CreditCourse, ...CreditCourse[]]
  /** What the student is told while the completion has no registration yet. */
  statusBeforeRegistration: StudentFacingCreditRegistrationStatus
  /** Set when a certificate could serve instead, which asks the detour questions first. */
  certificate: CertificateOffer | null
  /** Shown in the title band when the page signed the student in on their behalf. */
  signedInEmail?: string | undefined
}

const MOVING_REFETCH_INTERVAL_MS = 10_000
/** Sisu answers on its own schedule, so polling it hard buys nothing. */
const WAITING_FOR_SISU_REFETCH_INTERVAL_MS = 60_000
/** A waiting row changes only once a check finds the enrolment; a minute is soon enough. */
const WAITING_FOR_ENROLMENT_REFETCH_INTERVAL_MS = 60_000

/** How often one registration needs polling; `registration` is `null` before it is created. */
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

/** A module completion's registration and answers, which are read separately. */
const ModuleStatus: React.FC<CreditRegistrationStatusProps & { courseModuleId: string }> = ({
  courseModuleId,
  statusBeforeRegistration,
  courses: [course],
  ...props
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
  const numberQuery = useVerifiedNumberQuery()

  // Awaits all three: which page shows, and how many steps there are, follow from them together.
  return (
    <QueryResults
      queries={[query, routeQuery, numberQuery] as const}
      treatEmptyAsData
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionsCss}
      renderData={([data, enrolmentRoute, verifiedNumber]) => {
        const registration = data?.registration ?? null
        return (
          <RegistrationStepper
            {...props}
            statusBeforeRegistration={statusBeforeRegistration}
            courses={[{ ...course, registration, enrolmentRoute: enrolmentRoute ?? null }]}
            registration={registration}
            enrolmentRoute={enrolmentRoute ?? null}
            verifiedNumber={verifiedNumber ?? null}
            checkedAt={checkedAtOf(query.dataUpdatedAt)}
          >
            <EarlierAttempts attempts={data?.earlier_attempts ?? []} />
          </RegistrationStepper>
        )
      }}
    />
  )
}

/** A mooc.fi completion's registrations and answers under every course code, read at once. */
const MoocfiStatus: React.FC<CreditRegistrationStatusProps & { moocfiCompletionId: string }> = ({
  moocfiCompletionId,
  statusBeforeRegistration,
  courses,
  ...props
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
  const numberQuery = useVerifiedNumberQuery()

  return (
    <QueryResults
      queries={[query, numberQuery] as const}
      treatEmptyAsData
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionsCss}
      renderData={([data, verifiedNumber]) => {
        const codes = new Map(data.codes.map((code) => [code.external_completion_id, code]))
        const withStatus = (course: CreditCourse): StepperCourse => ({
          ...course,
          registration: codes.get(course.key)?.registration ?? null,
          enrolmentRoute: codes.get(course.key)?.enrolment_route ?? null,
        })
        return (
          <RegistrationStepper
            {...props}
            statusBeforeRegistration={statusBeforeRegistration}
            courses={[
              withStatus(courses[0]),
              ...courses.slice(1).map((course) => withStatus(course)),
            ]}
            registration={data.registration ?? null}
            enrolmentRoute={data.enrolment_route}
            verifiedNumber={verifiedNumber ?? null}
            checkedAt={checkedAtOf(query.dataUpdatedAt)}
          >
            <EarlierAttempts attempts={data.earlier_attempts} />
          </RegistrationStepper>
        )
      }}
    />
  )
}

const useVerifiedNumberQuery = () =>
  useQuery({ ...getMyVerifiedStudentNumberOptions(), refetchOnWindowFocus: true })

const checkedAtOf = (dataUpdatedAt: number): string | null =>
  dataUpdatedAt === 0 ? null : new Date(dataUpdatedAt).toISOString()

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
