import type {
  CreditRegistrationEnrolmentRoute,
  MyCreditRegistration,
  StudentRegistrationProgress,
  MyCreditRegistrationForCourseModule,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
  StudentFacingCreditRegistrationStatus,
  UserCompletionInformation,
} from "@/generated/api/types.generated"

/** Never a real module's id, so no request the demo answers can reach a real row. */
export const DEMO_COURSE_MODULE_ID = "00000000-0000-4000-8000-00000000de01"
const DEMO_COURSE_ID = "00000000-0000-4000-8000-00000000de02"
const DEMO_COMPLETION_ID = "00000000-0000-4000-8000-00000000de03"
export const DEMO_REGISTRATION_ID = "00000000-0000-4000-8000-00000000de04"
const DEMO_CERTIFICATE_CONFIGURATION_ID = "00000000-0000-4000-8000-00000000de05"

const DEMO_COURSE_NAME = "Introduction to Programming"
const DEMO_COURSE_CODE = "DEMO-1001"
const DEMO_ECTS_CREDITS = 5
const DEMO_ENROLMENT_LINK = "https://www.helsinki.fi/en/open-university"
const DEMO_STUDENT_NUMBER = "012345678"
const DEMO_EMAIL = "student@example.com"
const DEMO_EMAIL_MASKED = "s*****@example.com"

const UNIVERSITY_OF_HELSINKI: CreditRegistrationEnrolmentRoute = "university_of_helsinki"
const OPEN_UNIVERSITY: CreditRegistrationEnrolmentRoute = "open_university"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** Where the registration stands, in the order a student meets them. */
export const DEMO_STAGES = [
  "starting",
  "asks_where_enrolled",
  "certificate_chosen",
  "enrolment_confirmed",
  "linking_email_sent",
  "waiting_for_course_setup",
  "sending",
  "waiting_for_sisu",
  "processing_in_sisu",
  "registered",
  "failed",
  "not_registering",
] as const

export type DemoStage = (typeof DEMO_STAGES)[number]

/**
 * Whether the stage reads differently with a linked student number. A row is sent only under a
 * number, and a linking mail is only ever waited for without one, so those stages fix it.
 */
export const studentNumberRuleOf = (stage: DemoStage): "either" | "linked" | "unlinked" => {
  switch (stage) {
    case "linking_email_sent":
      return "unlinked"
    case "sending":
    case "waiting_for_sisu":
    case "processing_in_sisu":
    case "registered":
    case "failed":
      return "linked"
    default:
      return "either"
  }
}

export interface DemoVariants {
  stage: DemoStage
  isStudentNumberLinked: boolean
  hasCertificate: boolean
}

/** What the demo's fake server holds; buttons on the page change it the way the real API would. */
export interface DemoState {
  completion: UserCompletionInformation
  registration: MyCreditRegistrationForCourseModule | null
  enrolmentRoute: MyEnrolmentRoute
  studentNumber: MyVerifiedStudentNumber | null
}

/** Whether the stage needs the course to have a certificate, which fixes that switch. */
export const fixesCertificate = (stage: DemoStage): boolean => stage === "certificate_chosen"

export const isStudentNumberLinkedIn = ({
  stage,
  isStudentNumberLinked,
}: DemoVariants): boolean => {
  const rule = studentNumberRuleOf(stage)
  return rule === "either" ? isStudentNumberLinked : rule === "linked"
}

const iso = (ms: number): string => new Date(ms).toISOString()

/** The status a row has before its enrolment is found, which depends only on the number. */
const waitingStatus = (isLinked: boolean): StudentFacingCreditRegistrationStatus =>
  isLinked ? "needs_enrolment" : "needs_student_number"

const registrationFor = (
  stage: DemoStage,
  isLinked: boolean,
  nowMs: number,
): MyCreditRegistration | null => {
  const base: MyCreditRegistration = {
    attempt_number: 1,
    can_request_enrolment_recheck: false,
    completion_date: iso(nowMs - 2 * DAY_MS),
    course_id: DEMO_COURSE_ID,
    course_module_id: DEMO_COURSE_MODULE_ID,
    course_module_name: null,
    course_name: DEMO_COURSE_NAME,
    course_slug: "introduction-to-programming",
    credits: null,
    ects_credits: DEMO_ECTS_CREDITS,
    enrolment_checked_at: null,
    enrolment_found: false,
    enrolment_link: DEMO_ENROLMENT_LINK,
    enrolment_realisation_name: null,
    error_code: null,
    grade_id: null,
    grade_scale_id: null,
    id: DEMO_REGISTRATION_ID,
    is_processing_in_sisu: false,
    linking_email: null,
    next_attempt_at: iso(nowMs + HOUR_MS),
    notification_email: null,
    registered_at: null,
    registry_already_held_equal_or_better: false,
    sisu_attainment_id: null,
    status_is_moving: true,
    student_facing_status: waitingStatus(isLinked),
    student_number: null,
    submitted_at: null,
    superseded: false,
    uh_course_code: DEMO_COURSE_CODE,
  }
  const enrolled: MyCreditRegistration = {
    ...base,
    enrolment_found: true,
    enrolment_checked_at: iso(nowMs - 3 * HOUR_MS),
    enrolment_realisation_name: `${DEMO_COURSE_NAME}, autumn`,
    student_number: DEMO_STUDENT_NUMBER,
  }
  switch (stage) {
    case "starting":
    case "not_registering":
      return null
    case "asks_where_enrolled":
    case "certificate_chosen":
      return base
    case "enrolment_confirmed":
      return isLinked
        ? {
            ...base,
            student_facing_status: "looking_for_enrolment",
            enrolment_checked_at: iso(nowMs - 5 * MINUTE_MS),
          }
        : base
    case "linking_email_sent":
      return {
        ...base,
        linking_email: {
          email_send_status: "sent",
          emailed_to_masked: DEMO_EMAIL_MASKED,
          link_state: "usable",
          sent_at: iso(nowMs - 30 * MINUTE_MS),
        },
      }
    case "waiting_for_course_setup":
      return {
        ...base,
        student_facing_status: "waiting_for_course_setup",
        error_code: "course_code_not_found",
      }
    case "sending":
      return {
        ...enrolled,
        student_facing_status: "sending",
        progress: progressOf(["enrolment_found"], nowMs),
      }
    case "waiting_for_sisu":
      return {
        ...enrolled,
        student_facing_status: "waiting_for_sisu",
        submitted_at: iso(nowMs - 20 * MINUTE_MS),
        progress: progressOf(["enrolment_found", "sent_to_sisu"], nowMs),
      }
    case "processing_in_sisu":
      return {
        ...enrolled,
        student_facing_status: "waiting_for_sisu",
        submitted_at: iso(nowMs - 2 * HOUR_MS),
        is_processing_in_sisu: true,
        progress: progressOf(["enrolment_found", "sent_to_sisu", "accepted_by_sisu"], nowMs),
      }
    case "registered":
      return {
        ...enrolled,
        student_facing_status: "registered",
        status_is_moving: false,
        submitted_at: iso(nowMs - DAY_MS),
        registered_at: iso(nowMs - DAY_MS + HOUR_MS),
        credits: DEMO_ECTS_CREDITS,
        grade_id: "5",
        grade_scale_id: "sis-0-5",
        sisu_attainment_id: "demo-attainment",
        notification_email: {
          email_send_status: "sent",
          kind: "registered",
          sent_at: iso(nowMs - DAY_MS + HOUR_MS),
        },
      }
    case "failed":
      return {
        ...enrolled,
        student_facing_status: "failed",
        status_is_moving: false,
        submitted_at: iso(nowMs - DAY_MS),
        error_code: "sisu_validation_failed",
      }
  }
}

const PROGRESS_STEPS = [
  "enrolment_found",
  "sent_to_sisu",
  "accepted_by_sisu",
  "partially_registered",
] as const

/** The progress of a registration that has passed `done`, an hour apart, the last an hour ago. */
const progressOf = (
  done: readonly (typeof PROGRESS_STEPS)[number][],
  nowMs: number,
): StudentRegistrationProgress => ({
  completed_steps: done.map((step, index) => ({
    step,
    reached_at: iso(nowMs - (done.length - index) * HOUR_MS),
  })),
  current_step: PROGRESS_STEPS[done.length] ?? null,
  submission_uncertain: false,
})

const enrolmentRouteFor = (stage: DemoStage, nowMs: number): MyEnrolmentRoute => {
  const confirmed = stage === "enrolment_confirmed" || stage === "linking_email_sent"
  const choseCertificate = stage === "certificate_chosen"
  return {
    can_change: true,
    course_module_completion_id: DEMO_COMPLETION_ID,
    route: confirmed ? UNIVERSITY_OF_HELSINKI : choseCertificate ? OPEN_UNIVERSITY : null,
    enrolment_confirmed_at: confirmed ? iso(nowMs - 10 * MINUTE_MS) : null,
    has_finnish_personal_identity_code: choseCertificate ? false : null,
    need: choseCertificate ? "certificate" : null,
    identification: null,
    need_after_reconsider: null,
    certificate_chosen_at: choseCertificate ? iso(nowMs - DAY_MS) : null,
  }
}

export const buildDemoState = (variants: DemoVariants, nowMs: number): DemoState => {
  const isLinked = isStudentNumberLinkedIn(variants)
  const registration = registrationFor(variants.stage, isLinked, nowMs)
  return {
    completion: {
      course_module_completion_id: DEMO_COMPLETION_ID,
      course_module_name: null,
      course_name: DEMO_COURSE_NAME,
      ects_credits: DEMO_ECTS_CREDITS,
      email: DEMO_EMAIL,
      uh_course_code: DEMO_COURSE_CODE,
      registers_credits: true,
      register_credits_via_suotar: true,
      status_before_registration:
        variants.stage === "not_registering" ? "not_registering" : "sending",
      certificate_configuration_id:
        variants.hasCertificate || fixesCertificate(variants.stage)
          ? DEMO_CERTIFICATE_CONFIGURATION_ID
          : null,
      credit_justification: null,
      enrolment_link: DEMO_ENROLMENT_LINK,
    },
    registration: registration ? { registration, earlier_attempts: [] } : null,
    enrolmentRoute: enrolmentRouteFor(variants.stage, nowMs),
    studentNumber: isLinked
      ? {
          student_number: DEMO_STUDENT_NUMBER,
          verified_at: iso(nowMs - 30 * DAY_MS),
          verified_via: "emailed_link",
          verified_via_email_masked: DEMO_EMAIL_MASKED,
        }
      : null,
  }
}
