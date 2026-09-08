import type { MyCreditRegistration, MyEnrolmentRoute } from "@/generated/api/types.generated"

export interface TrackerViewInput {
  /** `null` before the pipeline has created a ledger row for the completion. */
  registration: MyCreditRegistration | null
  enrolmentRoute: MyEnrolmentRoute | null
}

/**
 * Whether the student is still being asked where they enrol.
 *
 * A found enrolment is the point of no return: the question only ever chose which enrolment
 * instructions to show, and by then those instructions have plainly been followed. The same is true
 * of every terminal state, where there is nothing left to enrol for.
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
  return !["registered", "failed", "not_registering"].includes(registration.student_facing_status)
}

/**
 * Whether the state needs saying in its own words, beside or instead of the question.
 *
 * While we are simply looking for an enrolment the question band has already said so — it ends with
 * the student's own "I have enrolled" — and repeating it underneath reads as two different things
 * happening. Every other state says something the question cannot.
 */
export const saysWhatIsHappening = (input: TrackerViewInput): boolean =>
  input.registration !== null &&
  (!asksWhereYouEnrolled(input) ||
    input.registration.student_facing_status !== "looking_for_enrolment")

/**
 * Whether the registration's own facts — when it was registered, the grade, the credits — belong on
 * the page. Only once there are any: before that the page is about what happens next.
 */
export const showsRegistrationFacts = (registration: MyCreditRegistration | null): boolean =>
  registration?.registered_at !== null && registration?.registered_at !== undefined
