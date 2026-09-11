import type {
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
} from "@/generated/api/types.generated"

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
const wasListedByTheRegistry = (registration: MyCreditRegistration): boolean =>
  registration.linking_email !== null && registration.linking_email !== undefined

/**
 * Whether the student is still being asked where they enrol.
 *
 * A found enrolment is the point of no return: the question only ever chose which enrolment
 * instructions to show, and by then those instructions have plainly been followed. The same is true
 * of every terminal state, where there is nothing left to enrol for, and of a student the registry
 * has already listed — telling them to go and enrol could cost them a second Open University fee.
 */
export const asksWhereYouEnrolled = ({
  registration,
  enrolmentRoute,
}: TrackerViewInput): boolean => {
  if (registration === null) {
    return false
  }
  if (registration.enrolment_found || enrolmentRoute?.can_change === false) {
    return false
  }
  if (wasListedByTheRegistry(registration)) {
    return false
  }
  return !["registered", "failed", "not_registering"].includes(registration.student_facing_status)
}

/** The two stages that both mean the same thing to a student: it is not in the records yet. */
const ENROLMENT_WAIT = ["looking_for_enrolment", "needs_enrolment"]

/**
 * Whether the page is waiting for the enrolment to turn up.
 *
 * One band covers both stages on purpose. `needs_enrolment` is entered on the very first look,
 * minutes after the student says they enrolled, so treating it as a verdict of its own would
 * report a routine "nothing there yet" as something having gone wrong. The only honest difference
 * is that we will look again on request, which is a button rather than a diagnosis.
 */
export const isWaitingForEnrolment = (input: TrackerViewInput): boolean =>
  input.registration !== null &&
  !input.registration.enrolment_found &&
  input.enrolmentRoute?.enrolment_confirmed_at !== null &&
  input.enrolmentRoute?.enrolment_confirmed_at !== undefined &&
  ENROLMENT_WAIT.includes(input.registration.student_facing_status)

/**
 * Whether the state needs saying in its own words.
 *
 * Silent through the enrolment wait and through `needs_student_number`, which have bands of their
 * own, and silent while the question band is still giving the enrolment instructions — repeating
 * them underneath reads as two different things happening. Every other state says something none
 * of those can.
 */
export const saysWhatIsHappening = (input: TrackerViewInput): boolean =>
  input.registration !== null &&
  input.registration.student_facing_status !== "needs_student_number" &&
  !isWaitingForEnrolment(input) &&
  !(
    asksWhereYouEnrolled(input) && ENROLMENT_WAIT.includes(input.registration.student_facing_status)
  )

/**
 * Whether the registration's own facts — when it was registered, the grade, the credits — belong on
 * the page. Only once there are any: before that the page is about what happens next.
 */
export const showsRegistrationFacts = (registration: MyCreditRegistration | null): boolean =>
  registration?.registered_at !== null && registration?.registered_at !== undefined

/**
 * What the linking band says: which student number the credits go to, or how one gets attached.
 *
 * `registering` and `linked` differ only in tense — a failed row is no longer a promise. `null`
 * means no band: once the credits are in the registry its fact sheet names the number, and a row
 * nobody is registering has no number to name.
 */
export type StudentNumberLinkBand =
  | { kind: "registering"; studentNumber: string }
  | { kind: "linked"; studentNumber: string }
  | { kind: "awaiting-enrolment" }
  | { kind: "mailing" }
  | { kind: "mailed"; emailMasked: string; sentAt: string }
  | { kind: "send-failed" }

export const studentNumberLinkBand = (
  registration: MyCreditRegistration,
  verifiedStudentNumber: MyVerifiedStudentNumber | null,
): StudentNumberLinkBand | null => {
  const status = registration.student_facing_status
  if (status === "not_registering") {
    return null
  }
  if (verifiedStudentNumber !== null) {
    if (showsRegistrationFacts(registration)) {
      return null
    }
    const studentNumber = verifiedStudentNumber.student_number
    return status === "failed"
      ? { kind: "linked", studentNumber }
      : { kind: "registering", studentNumber }
  }
  const mail = registration.linking_email
  if (mail?.email_send_status === "send_failed") {
    return { kind: "send-failed" }
  }
  if (mail?.email_send_status === "sent" && mail.sent_at) {
    return { kind: "mailed", emailMasked: mail.emailed_to_masked, sentAt: mail.sent_at }
  }
  // A mail still in the queue already proves the registry listed them, so the band cannot go on
  // telling them to enrol first.
  return mail ? { kind: "mailing" } : { kind: "awaiting-enrolment" }
}
