// TEMPORARY. Lets `?state=<name>` render every state of the registration page so all of them can be
// screenshotted without steering a real registration through the pipeline. Delete this file, its
// import in CreditRegistrationStatus, and the PREVIEW_STATE_PARAM query parameter once the page's
// look is settled.

import type {
  CreditRegistrationEnrolmentRoute,
  MyCreditRegistration,
  MyCreditRegistrationForCourseModule,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
} from "@/generated/api/types.generated"

import { OPEN_UNIVERSITY, UNIVERSITY_OF_HELSINKI } from "./constants"

export const PREVIEW_STATE_PARAM = "state"

const PREVIEW_STATES = [
  "unanswered",
  "answered-uh",
  "answered-open-university",
  "confirmed",
  "needs-student-number",
  "needs-student-number-mailing",
  "needs-student-number-mailed",
  "needs-student-number-send-failed",
  "looking-for-enrolment",
  "needs-enrolment",
  "sending",
  "waiting-for-sisu",
  "registered",
  "failed",
] as const

export type PreviewState = (typeof PREVIEW_STATES)[number]

export const isPreviewState = (value: string | null): value is PreviewState =>
  value !== null && (PREVIEW_STATES as readonly string[]).includes(value)

export interface PreviewedPage {
  registration: MyCreditRegistrationForCourseModule | null
  enrolmentRoute: MyEnrolmentRoute
  verifiedStudentNumber: MyVerifiedStudentNumber | null
}

const STUDENT_NUMBER = "014567890"
const COMPLETION_ID = "11111111-1111-1111-1111-111111111111"
const REGISTRATION_ID = "22222222-2222-2222-2222-222222222222"
const COMPLETED_AT = "2026-08-20T09:00:00Z"
const CHECKED_AT = "2026-09-08T08:40:00Z"
const SUBMITTED_AT = "2026-09-08T08:45:00Z"
const REGISTERED_AT = "2026-09-08T09:00:00Z"
const LINKED_AT = "2026-08-21T07:00:00Z"

const linkedStudentNumber: MyVerifiedStudentNumber = {
  student_number: STUDENT_NUMBER,
  verified_at: LINKED_AT,
  verified_via: "emailed_link",
  verified_via_email_masked: "...@helsinki.fi",
  first_names: "Kaisa Maria",
  last_name: "Virtanen",
  linked_automatically: false,
  auto_link_notice_dismissed: true,
}

const baseRegistration: MyCreditRegistration = {
  id: REGISTRATION_ID,
  course_id: "33333333-3333-3333-3333-333333333333",
  course_name: "Introduction to Programming",
  course_slug: "intro-to-programming",
  course_module_id: "44444444-4444-4444-4444-444444444444",
  course_module_name: null,
  uh_course_code: "AYTKT10002",
  ects_credits: 5,
  completion_date: COMPLETED_AT,
  student_facing_status: "looking_for_enrolment",
  registry_already_held_equal_or_better: false,
  status_is_moving: true,
  error_code: null,
  next_attempt_at: CHECKED_AT,
  registered_at: null,
  sisu_attainment_id: null,
  student_number: null,
  grade_id: null,
  grade_scale_id: null,
  credits: null,
  attempt_number: 1,
  superseded: false,
  can_request_enrolment_recheck: false,
  enrolment_found: false,
  enrolment_checked_at: CHECKED_AT,
  enrolment_realisation_name: null,
  submitted_at: null,
  enrolment_link: null,
  linking_email: null,
  notification_email: null,
}

const enrolled: Partial<MyCreditRegistration> = {
  enrolment_found: true,
  enrolment_realisation_name: "Autumn 2026",
}

const sent: Partial<MyCreditRegistration> = {
  ...enrolled,
  student_number: STUDENT_NUMBER,
  submitted_at: SUBMITTED_AT,
}

const ENROLMENT_LINK = "https://www.avoin.helsinki.fi/"

const needsStudentNumber: Partial<MyCreditRegistration> = {
  student_facing_status: "needs_student_number",
  status_is_moving: false,
}

const OVERRIDES: Record<PreviewState, Partial<MyCreditRegistration>> = {
  unanswered: {},
  "answered-uh": {},
  // A Suotar module names an open university product, so this branch always has somewhere to send
  // the student; without it the band would preview with no call to action.
  "answered-open-university": { enrolment_link: ENROLMENT_LINK },
  confirmed: {},
  // Before the mail: nothing has listed this person yet, so there is no Sisu person to write to.
  "needs-student-number": needsStudentNumber,
  "needs-student-number-mailing": {
    ...needsStudentNumber,
    linking_email: { email_send_status: "queued", emailed_to_masked: "...@helsinki.fi" },
  },
  "needs-student-number-mailed": {
    ...needsStudentNumber,
    linking_email: {
      email_send_status: "sent",
      sent_at: "2026-08-20T10:00:00Z",
      emailed_to_masked: "...@helsinki.fi",
    },
  },
  "needs-student-number-send-failed": {
    ...needsStudentNumber,
    linking_email: { email_send_status: "send_failed", emailed_to_masked: "...@helsinki.fi" },
  },
  "looking-for-enrolment": {},
  "needs-enrolment": {
    student_facing_status: "needs_enrolment",
    status_is_moving: false,
    can_request_enrolment_recheck: true,
    enrolment_link: ENROLMENT_LINK,
  },
  sending: { ...enrolled, student_facing_status: "sending" },
  "waiting-for-sisu": { ...sent, student_facing_status: "waiting_for_sisu" },
  registered: {
    ...sent,
    student_facing_status: "registered",
    status_is_moving: false,
    registered_at: REGISTERED_AT,
    sisu_attainment_id: "otm-0000",
    grade_id: "4",
    grade_scale_id: "sis-0-5",
    credits: 5,
  },
  // A failure the pipeline can actually reach: the enrolment codes park a row on the enrolment
  // wait instead, and `person_not_found` sends it back for a student number.
  failed: {
    ...sent,
    student_facing_status: "failed",
    status_is_moving: false,
    error_code: "sisu_validation_failed",
  },
}

const ROUTES: Record<PreviewState, CreditRegistrationEnrolmentRoute | null> = {
  unanswered: null,
  "answered-uh": UNIVERSITY_OF_HELSINKI,
  "answered-open-university": OPEN_UNIVERSITY,
  confirmed: UNIVERSITY_OF_HELSINKI,
  "needs-student-number": null,
  "needs-student-number-mailing": UNIVERSITY_OF_HELSINKI,
  "needs-student-number-mailed": UNIVERSITY_OF_HELSINKI,
  "needs-student-number-send-failed": OPEN_UNIVERSITY,
  "looking-for-enrolment": UNIVERSITY_OF_HELSINKI,
  "needs-enrolment": OPEN_UNIVERSITY,
  sending: UNIVERSITY_OF_HELSINKI,
  "waiting-for-sisu": UNIVERSITY_OF_HELSINKI,
  registered: UNIVERSITY_OF_HELSINKI,
  failed: UNIVERSITY_OF_HELSINKI,
}

const UNCONFIRMED: PreviewState[] = [
  "unanswered",
  "answered-uh",
  "answered-open-university",
  "needs-student-number",
  "needs-student-number-mailing",
  "needs-student-number-mailed",
  "needs-student-number-send-failed",
]

/** The states that follow the linking step, where the page says which number the credits go to. */
const LINKED: PreviewState[] = [
  "confirmed",
  "looking-for-enrolment",
  "needs-enrolment",
  "sending",
  "waiting-for-sisu",
  "registered",
  "failed",
]

export const previewPage = (state: PreviewState): PreviewedPage => {
  const registration = { ...baseRegistration, ...OVERRIDES[state] }
  return {
    registration: { registration, earlier_attempts: [] },
    enrolmentRoute: {
      course_module_completion_id: COMPLETION_ID,
      route: ROUTES[state],
      enrolment_confirmed_at: UNCONFIRMED.includes(state) ? null : COMPLETED_AT,
      can_change: !registration.enrolment_found,
    },
    verifiedStudentNumber: LINKED.includes(state) ? linkedStudentNumber : null,
  }
}
