"use client"

import { ArrowUpFromSquare, Clock } from "@vectopus/atlas-icons-react"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import type { StudentFacingCreditRegistrationStatus } from "@/generated/api/types.generated"
import { Infobox, Link, RelativeTime, Spinner } from "@/shared-module/components"
import { CheckIcon } from "@/shared-module/components/components/primitives/CheckIcon"
import { httpsUrlOrNull } from "@/utils/httpsUrl"
import { formatConjunctionList } from "@/utils/listFormat"

import {
  BUTTON_PRIMARY,
  CREDIT_REGISTRATION_NS,
  ICON_AT_END,
  TIME_DATE,
  TIME_IN_TITLE,
  TONE,
} from "../constants"
import { registrationExplanation } from "../creditRegistrationCopy"
import { NotificationEmailLine } from "../EmailStatusLine"
import { SisuCourseCode } from "../SisuCourseCode"
import { StudentRegistrationExplanation } from "../StudentRegistrationExplanation"
import { OpenUniversityIdentificationCaption } from "./EnrolmentPage"
import {
  LastChecked,
  omaOpintopolkuLink,
  ProgressList,
  RecheckLever,
  RegistrationFacts,
  sisuLink,
  StatusHeading,
} from "./StatusPage"
import {
  captionCss,
  courseBlockCss,
  courseMarkDoneCss,
  courseMarkSpinnerCss,
  courseMarkTodoCss,
  courseMarkWaitingCss,
  pageCss,
  sectionDividerCss,
  sectionTitleCss,
  statusHeadCss,
  statusMarkDoneCss,
  statusMarkWaitingCss,
  underCourseMarkCss,
} from "./stepperStyles"
import {
  type CourseStage,
  isEnrollingStage,
  isRegisteringStage,
  type StepperCourse,
} from "./stepperView"

const ICON_SIZE = 22
const COURSE_ICON_SIZE = 15
const EXTERNAL_ICON_SIZE = 16

const NEEDS_ENROLMENT: CourseStage = "needs-enrolment"
const AWAITING_ENROLMENT: CourseStage = "awaiting-enrolment"
const NOT_REGISTERING: StudentFacingCreditRegistrationStatus = "not_registering"

export interface CoursesStatusPageProps {
  /** `waiting` while no course has moved on and the student said they enrolled. */
  kind: "waiting" | "courses"
  courses: readonly StepperCourse[]
  /** The stage of each of `courses`, in the same order. */
  stages: readonly CourseStage[]
  studentNumber: string | null
  /** Enrolled through Sisu rather than at the Open University. */
  isDegreeStudent: boolean
  checkedAt: string | null
  /** Rendered after the courses while waiting: what the student told us, and the way back. */
  children?: React.ReactNode
}

/** Where each course of a completion that earns several stands, one section per course. */
export const CoursesStatusPage: React.FC<CoursesStatusPageProps> = ({
  kind,
  courses,
  stages,
  studentNumber,
  isDegreeStudent,
  checkedAt,
  children,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const listNames = (names: string[]) => formatConjunctionList(i18n.language, names)
  const rows = courses.map((course, index) => ({
    course,
    stage: stages[index] ?? NEEDS_ENROLMENT,
  }))
  const notYourNumber = studentNumber ? (
    <p className={captionCss}>{t("credit-registration-link-not-your-number-active")}</p>
  ) : null

  if (kind === "waiting") {
    const lastCheckedAt = latest(
      rows.map(({ course }) => course.registration?.enrolment_checked_at),
    )
    return (
      <div className={pageCss}>
        <StatusHeading
          mark={
            <span className={statusMarkWaitingCss} aria-hidden="true">
              <Clock size={ICON_SIZE} />
            </span>
          }
        >
          {t("credit-registration-courses-waiting-heading")}
        </StatusHeading>
        <p>{t("credit-registration-courses-waiting-body", { studentNumber })}</p>
        <p className={captionCss}>{t("credit-registration-waiting-for-enrolment-timing")}</p>
        <CourseBlocks>
          {rows.map(({ course }) => (
            <CourseBlock key={course.uhCourseCode} course={course} stage={AWAITING_ENROLMENT}>
              <p>{t("credit-registration-course-enrolment-not-found-yet")}</p>
            </CourseBlock>
          ))}
        </CourseBlocks>
        {lastCheckedAt ? (
          <p className={captionCss}>
            {t("credit-registration-last-checked")}{" "}
            <RelativeTime at={lastCheckedAt} absoluteTime={TIME_IN_TITLE} />
          </p>
        ) : null}
        {children}
        {notYourNumber}
      </div>
    )
  }

  const enrolling = rows.filter(({ stage }) => isEnrollingStage(stage))
  const registered = rows.filter(({ stage }) => stage === "registered")
  const isAllRegistered = registered.length === rows.length
  const stopped = rows.find(({ stage }) => stage === "stopped")
  const registering = rows.filter(({ stage }) => isRegisteringStage(stage))
  // A course with no answers of its own was added after the student went through the steps: the
  // completion's tier went up.
  const isNewlyEarned =
    enrolling.length > 0 &&
    registered.length + enrolling.length === rows.length &&
    enrolling.every(({ course }) => !course.enrolmentRoute?.route)
  const enrollingNames = listNames(enrolling.map(({ course }) => course.name))

  const head = (() => {
    if (isAllRegistered) {
      return (
        <>
          <StatusHeading
            mark={
              <span className={statusMarkDoneCss} aria-hidden="true">
                <CheckIcon />
              </span>
            }
          >
            {t("credit-registration-registered-heading")}
          </StatusHeading>
          <p>
            {isDegreeStudent ? (
              <Trans
                t={t}
                i18nKey="credit-registration-registered-see-it-in-sisu"
                components={{ sisuLink }}
              />
            ) : (
              <Trans
                t={t}
                i18nKey="credit-registration-registered-see-it-in-oma-opintopolku"
                components={{ omaOpintopolkuLink }}
              />
            )}
          </p>
        </>
      )
    }
    if (enrolling.length > 0) {
      return (
        <>
          <StatusHeading mark={null}>
            {enrolling.length === 1
              ? t("credit-registration-courses-enrol-on-heading", { course: enrollingNames })
              : t("credit-registration-courses-enrol-on-remaining-heading")}
          </StatusHeading>
          {isNewlyEarned ? (
            <Infobox tone={TONE.INFO}>
              {t("credit-registration-courses-newly-earned", {
                courses: enrollingNames,
                registered: listNames(registered.map(({ course }) => course.name)),
                count: registered.length,
              })}
            </Infobox>
          ) : (
            <p>
              {registering.length > 0 && studentNumber
                ? `${t("credit-registration-courses-registering-others", {
                    courses: listNames(registering.map(({ course }) => course.name)),
                    studentNumber,
                  })} `
                : null}
              {t("credit-registration-courses-enrol-to-get-credits", {
                courses: enrollingNames,
                count: enrolling.length,
              })}
            </p>
          )}
        </>
      )
    }
    if (stopped) {
      return <StatusHeading mark={null}>{stoppedLabel(t, stopped.course)}</StatusHeading>
    }
    return (
      <>
        <StatusHeading mark={<Spinner size="md" />}>
          {t("credit-registration-registering-heading")}
        </StatusHeading>
        <p>
          {studentNumber
            ? t("credit-registration-registering-body", { studentNumber })
            : t("credit-registration-registering-body-without-number")}
        </p>
      </>
    )
  })()

  const isMoving = rows.some(({ course }) => course.registration?.status_is_moving)
  const lastRegistered = latestRegistered(registered.map(({ course }) => course))

  return (
    <div className={pageCss}>
      {head}
      <CourseBlocks>
        {rows.map(({ course, stage }) => (
          <CourseBlock key={course.uhCourseCode} course={course} stage={stage}>
            <CourseStatus
              course={course}
              stage={stage}
              isAllRegistered={isAllRegistered}
              isDegreeStudent={isDegreeStudent}
              showsIdentification={isNewlyEarned}
            />
          </CourseBlock>
        ))}
      </CourseBlocks>
      {isAllRegistered && lastRegistered ? (
        <NotificationEmailLine notificationEmail={lastRegistered.notification_email} />
      ) : null}
      {!isAllRegistered && isMoving && checkedAt ? <LastChecked checkedAt={checkedAt} /> : null}
      {children}
      {isAllRegistered ? null : notYourNumber}
    </div>
  )
}

const CourseBlocks: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>
    {React.Children.map(children, (child, index) =>
      index === 0 ? child : <div className={sectionDividerCss}>{child}</div>,
    )}
  </div>
)

/** One course's heading with its mark, and what is under it. */
const CourseBlock: React.FC<{
  course: StepperCourse
  stage: CourseStage
  children: React.ReactNode
}> = ({ course, stage, children }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <section className={courseBlockCss}>
      <div className={statusHeadCss}>
        <CourseMark stage={stage} />
        <div>
          <h3 className={sectionTitleCss}>{course.name}</h3>
          <p className={captionCss}>
            <Trans
              t={t}
              i18nKey="credit-registration-course-code-and-credits"
              values={{
                credits: t("ects-n", { count: course.ectsCredits, n: course.ectsCredits }),
              }}
              components={{ courseCode: <SisuCourseCode code={course.uhCourseCode} /> }}
            />
          </p>
        </div>
      </div>
      <div className={underCourseMarkCss}>{children}</div>
    </section>
  )
}

const CourseMark: React.FC<{ stage: CourseStage }> = ({ stage }) => {
  switch (stage) {
    case "registered":
      return (
        <span className={courseMarkDoneCss} aria-hidden="true">
          <CheckIcon />
        </span>
      )
    case "registering":
      return (
        <span className={courseMarkSpinnerCss}>
          <Spinner size="md" />
        </span>
      )
    case "waiting-for-prerequisite":
    case "awaiting-enrolment":
      return (
        <span className={courseMarkWaitingCss} aria-hidden="true">
          <Clock size={COURSE_ICON_SIZE} />
        </span>
      )
    case "needs-enrolment":
      return <span className={courseMarkTodoCss} aria-hidden="true" />
    case "stopped":
      return null
  }
}

/** What is under one course's heading on the page that shows every course. */
const CourseStatus: React.FC<{
  course: StepperCourse
  stage: CourseStage
  isAllRegistered: boolean
  isDegreeStudent: boolean
  /** The student has not seen the enrolment instructions for this course. */
  showsIdentification: boolean
}> = ({ course, stage, isAllRegistered, isDegreeStudent, showsIdentification }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { registration } = course
  switch (stage) {
    case "registered": {
      if (!registration?.registered_at) {
        return <p>{t("credit-registration-course-already-in-sisu")}</p>
      }
      if (isAllRegistered) {
        return (
          <RegistrationFacts registration={registration} moduleEctsCredits={course.ectsCredits} />
        )
      }
      return (
        <p>
          <Trans
            t={t}
            i18nKey="credit-registration-course-registered-on"
            components={{
              date: <RelativeTime at={registration.registered_at} absoluteTime={TIME_DATE} />,
            }}
          />
        </p>
      )
    }
    case "registering":
      return registration?.progress ? <ProgressList progress={registration.progress} /> : null
    case "waiting-for-prerequisite":
      return (
        <p>
          {t("credit-registration-course-waiting-for-prerequisite", {
            prerequisite: course.prerequisiteName ?? "",
          })}
        </p>
      )
    case "needs-enrolment":
    case "awaiting-enrolment":
      return (
        <EnrolToContinue
          course={course}
          isDegreeStudent={isDegreeStudent}
          showsIdentification={showsIdentification}
        />
      )
    case "stopped":
      return registration ? (
        <StudentRegistrationExplanation registration={registration} />
      ) : (
        <p>{registrationExplanation(t, NOT_REGISTERING)}</p>
      )
  }
}

/** The enrol lever for a course whose enrolment has not turned up while another course moved on. */
const EnrolToContinue: React.FC<{
  course: StepperCourse
  isDegreeStudent: boolean
  showsIdentification: boolean
}> = ({ course, isDegreeStudent, showsIdentification }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const enrolmentLink = httpsUrlOrNull(course.enrolmentLink)
  const courseCode = { courseCode: <SisuCourseCode code={course.uhCourseCode} /> }
  return (
    <>
      <p>
        {isDegreeStudent ? (
          <Trans t={t} i18nKey="credit-registration-course-enrol-in-sisu" components={courseCode} />
        ) : (
          <Trans
            t={t}
            i18nKey="credit-registration-course-enrol-to-get-credits"
            components={courseCode}
          />
        )}
      </p>
      {!isDegreeStudent && enrolmentLink ? (
        <div>
          <Link
            href={enrolmentLink}
            target="_blank"
            rel="noopener noreferrer"
            styledAsButton
            variant={BUTTON_PRIMARY}
            size="medium"
            icon={<ArrowUpFromSquare size={EXTERNAL_ICON_SIZE} aria-hidden="true" />}
            iconPosition={ICON_AT_END}
          >
            {t("credit-registration-action-enrol-on-course", { course: course.name })}
          </Link>
        </div>
      ) : null}
      {!isDegreeStudent && showsIdentification ? <OpenUniversityIdentificationCaption /> : null}
      <p className={captionCss}>
        {isDegreeStudent
          ? t("credit-registration-course-already-enrolled-sisu")
          : t("credit-registration-course-already-enrolled-open-university")}
      </p>
      {course.registration ? <RecheckLever registration={course.registration} /> : null}
    </>
  )
}

const stoppedLabel = (
  t: ReturnType<typeof useTranslation<typeof CREDIT_REGISTRATION_NS>>["t"],
  course: StepperCourse,
): string =>
  course.registration?.student_facing_status === "failed"
    ? t("credit-registration-status-failed")
    : t("credit-registration-courses-some-not-registering-heading")

const latest = (timestamps: (string | null | undefined)[]): string | null =>
  timestamps.reduce<string | null>(
    (newest, at) => (at && (newest === null || at > newest) ? at : newest),
    null,
  )

const latestRegistered = (courses: StepperCourse[]) => {
  const at = latest(courses.map((course) => course.registration?.registered_at))
  return courses.find((course) => course.registration?.registered_at === at)?.registration ?? null
}
