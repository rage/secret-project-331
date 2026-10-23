import type {
  CreditRegistrationErrorCode,
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
} from "@/generated/api/types.generated"

import { OPEN_UNIVERSITY } from "./constants"

export interface TrackerViewInput {
  /** `null` before the pipeline has created a ledger row for the completion. */
  registration: MyCreditRegistration | null
  enrolmentRoute: MyEnrolmentRoute | null
}

/**
 * Whether a linking mail has been claimed for this person on this course.
 *
 * Doubles as proof that they enrolled: the mail is minted from the study registry's own roster for
 * the course, so it cannot exist for someone the registry has never listed.
 */
export const wasListedByTheRegistry = (registration: MyCreditRegistration | null): boolean =>
  registration?.linking_email !== null && registration?.linking_email !== undefined

/**
 * Whether the enrolment question still decides anything, judged from the ledger row alone.
 *
 * A found enrolment is the point of no return: the question only ever chose which enrolment
 * instructions to show, and by then those instructions have plainly been followed. The same is true
 * of every terminal state, where there is nothing left to enrol for, and of a student the registry
 * has already listed — telling them to go and enrol could cost them a second Open University fee.
 * `waiting_for_course_setup` is not terminal, but it is parked on a course-side problem the pipeline
 * has not gotten past to start looking for an enrolment, so asking would be premature, not helpful.
 * `sending` and `waiting_for_sisu` only follow a settled enrolment.
 */
export const stillNeedsAnEnrolmentAnswer = (registration: MyCreditRegistration): boolean => {
  if (registration.enrolment_found) {
    return false
  }
  if (wasListedByTheRegistry(registration)) {
    return false
  }
  return ![
    "registered",
    "failed",
    "not_registering",
    "waiting_for_course_setup",
    "sending",
    "waiting_for_sisu",
  ].includes(registration.student_facing_status)
}

/**
 * Whether the registration's own facts — when it was registered, the grade, the credits — belong on
 * the page. Only once there are any: before that the page is about what happens next.
 */
export const showsRegistrationFacts = (registration: MyCreditRegistration | null): boolean =>
  registration?.registered_at !== null && registration?.registered_at !== undefined

/**
 * What the linking band says: which student number the credits go to, or how one gets attached.
 *
 * `registering` and `linked` differ only in tense — a failed or registered row is no longer a
 * promise, and `duplicate` and `not_improved` rows read as registered with no fact sheet. `null`
 * means no band: once the credits are in the registry its fact sheet names the number, and a row
 * nobody is registering has no number to name.
 *
 * `awaiting-email` replaces the enrol step once the student has said they enrolled, or once a mail
 * is queued: either way enrolling is behind them. `contact-support` is for when no mail can come
 * any more: the latest link was used, or it expired with the caps spent.
 */
export type StudentNumberLinkBand =
  | { kind: "registering"; studentNumber: string }
  | { kind: "linked"; studentNumber: string }
  | { kind: "awaiting-enrolment" }
  | { kind: "awaiting-email"; isOpenUniversity: boolean }
  | { kind: "staff-links" }
  | { kind: "mailed"; emailMasked: string; sentAt: string }
  | { kind: "link-expired"; emailMasked: string; sentAt: string }
  | { kind: "send-failed" }
  | { kind: "contact-support" }

export interface StudentNumberLinkBandOptions {
  isAccountLinkingEnabled: boolean
  enrolmentRoute: MyEnrolmentRoute | null
}

export const studentNumberLinkBand = (
  registration: MyCreditRegistration,
  verifiedStudentNumber: MyVerifiedStudentNumber | null,
  { isAccountLinkingEnabled, enrolmentRoute }: StudentNumberLinkBandOptions,
): StudentNumberLinkBand | null => {
  const status = registration.student_facing_status
  if (status === "not_registering") {
    return null
  }
  // Judged before the link is read, not inside it: a registered row whose account has since been
  // unlinked would otherwise fall through to the band telling them to go and enrol.
  if (showsRegistrationFacts(registration)) {
    return null
  }
  if (verifiedStudentNumber !== null) {
    const studentNumber = verifiedStudentNumber.student_number
    return status === "failed" || status === "registered"
      ? { kind: "linked", studentNumber }
      : { kind: "registering", studentNumber }
  }
  const mail = registration.linking_email
  const usableMail = mail?.link_state === "usable" ? mail : null
  if (usableMail?.email_send_status === "send_failed") {
    return { kind: "send-failed" }
  }
  if (usableMail?.email_send_status === "sent" && usableMail.sent_at) {
    return { kind: "mailed", emailMasked: usableMail.emailed_to_masked, sentAt: usableMail.sent_at }
  }
  // With linking off a queued mail is never sent and no new one comes, so no band below can
  // promise one.
  if (!isAccountLinkingEnabled) {
    return { kind: "staff-links" }
  }
  if (mail?.link_state === "expired_can_resend" && mail.sent_at) {
    return { kind: "link-expired", emailMasked: mail.emailed_to_masked, sentAt: mail.sent_at }
  }
  if (mail?.link_state === "used" || mail?.link_state === "expired_no_resend") {
    return { kind: "contact-support" }
  }
  if (enrolmentRoute?.enrolment_confirmed_at || usableMail !== null) {
    return { kind: "awaiting-email", isOpenUniversity: enrolmentRoute?.route === OPEN_UNIVERSITY }
  }
  return { kind: "awaiting-enrolment" }
}

/** How long after "I have enrolled" a student is asked to check, when nothing else has said why. */
const ENROLMENT_CHECK_AFTER_MS = 2 * 60 * 60 * 1000

/** The registry verdicts that say why a linked student's enrolment is still not seen. */
const ENROLMENT_CHECK_ERRORS = [
  "enrolment_not_found",
  "enrolment_not_accepted",
  "study_right_not_valid",
] as const satisfies readonly CreditRegistrationErrorCode[]

export type EnrolmentCheckErrorCode = (typeof ENROLMENT_CHECK_ERRORS)[number]

/** Why the "Check your enrolment" box opens. */
export type EnrolmentCheckOpening =
  | { kind: "registry-verdict"; errorCode: EnrolmentCheckErrorCode }
  | { kind: "still-not-seen" }

/** Whether the error code is one the enrolment check box explains. */
const isEnrolmentCheckError = (
  errorCode: CreditRegistrationErrorCode | null | undefined,
): errorCode is EnrolmentCheckErrorCode => ENROLMENT_CHECK_ERRORS.some((code) => code === errorCode)

/**
 * Why a student who said they enrolled is asked to check their enrolment; `null` hides the box.
 *
 * A registry verdict opens it at once, but only reaches a student with a linked number: without
 * one the registry cannot be asked about them.
 */
export const enrolmentCheckOpening = (
  { registration, enrolmentRoute }: TrackerViewInput,
  hasLinkedStudentNumber: boolean,
  nowMs: number,
): EnrolmentCheckOpening | null => {
  const confirmedAt = enrolmentRoute?.enrolment_confirmed_at
  if (
    !confirmedAt ||
    enrolmentRoute?.can_change === false ||
    (registration !== null && !stillNeedsAnEnrolmentAnswer(registration))
  ) {
    return null
  }
  const errorCode = registration?.error_code
  if (hasLinkedStudentNumber && isEnrolmentCheckError(errorCode)) {
    return { kind: "registry-verdict", errorCode }
  }
  return nowMs - new Date(confirmedAt).getTime() >= ENROLMENT_CHECK_AFTER_MS
    ? { kind: "still-not-seen" }
    : null
}
