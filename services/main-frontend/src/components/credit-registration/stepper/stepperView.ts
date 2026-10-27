import type {
  MyCreditRegistration,
  MyEnrolmentRoute,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"

import { OPEN_UNIVERSITY, UNIVERSITY_OF_HELSINKI } from "../constants"
import { wasListedByTheRegistry } from "../trackerView"

/** Where the student's answers send them. */
export type DetourRoute = "sisu" | "open-university" | "certificate"

/** The pages of the stepper, in the order the student goes through them. */
export const STEPPER_PAGES = [
  "overview",
  "questions",
  "enrolment",
  "linking",
  "certificate",
] as const
export type StepperPage = (typeof STEPPER_PAGES)[number]

/** The pages by name, for the code that moves between them. */
export const PAGE = {
  overview: "overview",
  questions: "questions",
  enrolment: "enrolment",
  linking: "linking",
  certificate: "certificate",
} as const satisfies Record<StepperPage, StepperPage>

/** A page with no step bar: the registration is past what the student drives. */
export type StatusPage =
  | "waiting"
  | "registering"
  | "registered"
  | "failed"
  | "course-setup"
  | "not-registering"

/** The numbered steps shown in the step bar. */
export type Step = "questions" | "enrolment" | "linking"

export interface StepperInput {
  /** `null` before the pipeline has created a ledger row for the completion. */
  registration: MyCreditRegistration | null
  /** What the student is told while the completion has no registration yet. */
  statusBeforeRegistration: StudentFacingCreditRegistrationStatus
  enrolmentRoute: MyEnrolmentRoute | null
  hasLinkedStudentNumber: boolean
  /** A certificate could serve instead, which asks the detour questions. */
  hasCertificate: boolean
  hasSavedJustification: boolean
}

/**
 * Where the answers lead, or `null` while a question on the way is unanswered.
 *
 * Each answer counts only while the one above it leads to its question, so a stale answer under a
 * changed one never decides anything.
 */
export const detourRoute = (
  enrolmentRoute: MyEnrolmentRoute | null,
  hasCertificate: boolean,
  hasSavedJustification: boolean,
): DetourRoute | null => {
  if (enrolmentRoute?.route === UNIVERSITY_OF_HELSINKI) {
    return "sisu"
  }
  if (enrolmentRoute?.route !== OPEN_UNIVERSITY) {
    return null
  }
  if (!hasCertificate) {
    return "open-university"
  }
  const { has_finnish_personal_identity_code, need, identification, need_after_reconsider } =
    enrolmentRoute
  if (has_finnish_personal_identity_code === true) {
    return "open-university"
  }
  if (has_finnish_personal_identity_code !== false) {
    return null
  }
  if (need === "certificate") {
    return "certificate"
  }
  if (need !== "credits") {
    return null
  }
  if (identification === "eidas" || identification === "other_suomi_fi") {
    return "open-university"
  }
  if (identification !== "none") {
    return null
  }
  if (need_after_reconsider === "certificate") {
    return "certificate"
  }
  return need_after_reconsider === "credits" && hasSavedJustification ? "open-university" : null
}

/** The page that replaces the stepper once the registration is past what the student drives. */
export const statusPageOf = (input: StepperInput): StatusPage | null => {
  const { registration, statusBeforeRegistration, enrolmentRoute } = input
  if (registration === null) {
    if (statusBeforeRegistration === "not_registering") {
      return "not-registering"
    }
    return input.hasLinkedStudentNumber && hasSaidTheyEnrolled(input) ? "waiting" : null
  }
  if (registration.registered_at) {
    return "registered"
  }
  switch (registration.student_facing_status) {
    case "not_registering":
      return "not-registering"
    case "registered":
      return "registered"
    case "failed":
      return "failed"
    case "waiting_for_course_setup":
      return "course-setup"
    case "sending":
    case "waiting_for_sisu":
      return "registering"
    case "looking_for_enrolment":
    case "needs_enrolment":
    case "needs_student_number":
    case "waiting_for_completion":
      break
  }
  if (registration.enrolment_found || enrolmentRoute?.can_change === false) {
    return "registering"
  }
  if (input.hasLinkedStudentNumber && hasSaidTheyEnrolled(input)) {
    return "waiting"
  }
  return null
}

/** Whether the student said they enrolled, or the registry has shown that they did. */
const hasSaidTheyEnrolled = ({ registration, enrolmentRoute }: StepperInput): boolean =>
  Boolean(enrolmentRoute?.enrolment_confirmed_at) || wasListedByTheRegistry(registration)

/** The numbered steps. Linking only for a student whose number is not linked yet. */
export const stepsFor = (hasLinkedStudentNumber: boolean): Step[] =>
  hasLinkedStudentNumber ? ["questions", "enrolment"] : ["questions", "enrolment", "linking"]

const hasAnyAnswer = (enrolmentRoute: MyEnrolmentRoute | null): boolean =>
  Boolean(enrolmentRoute?.route)

/** The page a student lands on: where they left off. Only meaningful without a status page. */
export const landingPage = (input: StepperInput): StepperPage => {
  const { enrolmentRoute } = input
  if (enrolmentRoute?.certificate_chosen_at) {
    return "certificate"
  }
  if (hasSaidTheyEnrolled(input) && !input.hasLinkedStudentNumber) {
    return "linking"
  }
  const route = detourRoute(enrolmentRoute, input.hasCertificate, input.hasSavedJustification)
  if (route === "sisu" || route === "open-university") {
    return "enrolment"
  }
  return hasAnyAnswer(enrolmentRoute) ? "questions" : "overview"
}

/**
 * Whether the student may open a page by its address or the step bar.
 *
 * Once the registry has listed them, only linking is left: the instructions would only invite a
 * second enrolment.
 */
export const isReachable = (page: StepperPage, input: StepperInput): boolean => {
  const { enrolmentRoute } = input
  if (wasListedByTheRegistry(input.registration)) {
    return page === "linking" && !input.hasLinkedStudentNumber
  }
  const route = detourRoute(enrolmentRoute, input.hasCertificate, input.hasSavedJustification)
  switch (page) {
    case "overview":
    case "questions":
      return true
    case "enrolment":
      return route === "sisu" || route === "open-university"
    case "linking":
      return !input.hasLinkedStudentNumber && hasSaidTheyEnrolled(input)
    case "certificate":
      return Boolean(enrolmentRoute?.certificate_chosen_at)
  }
}

/** Whether the student can still take back "I have enrolled". */
export const canWithdrawEnrolmentConfirmation = (input: StepperInput): boolean =>
  Boolean(input.enrolmentRoute?.enrolment_confirmed_at) &&
  input.enrolmentRoute?.can_change !== false &&
  !wasListedByTheRegistry(input.registration)

/** The step a page belongs to, for the step bar; `null` on pages without one. */
export const stepOf = (page: StepperPage): Step | null => {
  switch (page) {
    case "questions":
    case "enrolment":
    case "linking":
      return page
    case "overview":
    case "certificate":
      return null
  }
}

export const isStepperPage = (value: string | null): value is StepperPage =>
  STEPPER_PAGES.some((page) => page === value)
