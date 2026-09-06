import type { TFunction } from "i18next"

import type { CreditRegistrationErrorCode } from "@/generated/api/types.generated"

import { labelFrom, widenedLookup } from "./labelFrom"

/**
 * Who has to act before this failure can clear.
 *
 * The bucket a surface names when it says whose problem a failure is; derived from
 * `FailureRemedy`, which is the finer distinction the actions come from.
 */
export type FailureOwner = "course_setup" | "student" | "registry" | "support"

/**
 * What actually clears the failure. Finer than `FailureOwner` because one owner can have two
 * different jobs: a student whose linked number is wrong does something else than a student with
 * no enrolment, and a registry timeout wants a check rather than another send.
 */
export type FailureRemedy =
  | "module_configuration"
  | "student_number"
  | "student_enrolment"
  | "retry"
  | "recheck"
  | "support"

/** Who is reading. The remedy is the same for everyone; the actions available are not. */
export type FailureAudience = "student" | "teacher" | "admin"

/** One offerable action. A surface renders these as buttons or links in the order the plan gives. */
export type FailureAction =
  | "retry"
  | "recheck_registry"
  | "fix_module_configuration"
  | "resend_student_number_link"
  | "link_student_number_by_hand"
  | "check_own_student_number"
  | "enrol"
  | "recheck_enrolment"
  | "email_student"
  | "contact_support"

/**
 * What can be done about one failed registration, and by whom.
 *
 * `primary` is null when this reader has no action that could help — which is the answer for most
 * failures on most surfaces, and the point of asking: a page that renders the plan cannot offer a
 * retry on a failure a retry cannot clear.
 */
export interface FailureActionPlan {
  owner: FailureOwner
  remedy: FailureRemedy
  /** Worth a primary button. Null means nothing this reader does helps; say who is on it instead. */
  primary: FailureAction | null
  /** Offered after `primary`, in this order. May be empty. */
  secondary: readonly FailureAction[]
}

/**
 * Exhaustive by construction: a new error code stops the build here rather than reaching a page as
 * an unclassified failure that everything offers a retry on.
 */
const FAILURE_REMEDIES = {
  missing_uh_course_code: "module_configuration",
  missing_ects_credits: "module_configuration",
  no_grade_scale_mapping: "module_configuration",
  course_code_not_found: "module_configuration",
  invalid_credits: "module_configuration",
  invalid_grade_for_grade_scale: "module_configuration",

  person_not_found: "student_number",
  enrolment_not_found: "student_enrolment",
  enrolment_not_accepted: "student_enrolment",
  study_right_not_valid: "student_enrolment",

  sisu_temporarily_unavailable: "retry",
  transport_error: "retry",
  unexpected_response: "retry",
  retry_window_expired: "retry",
  // A timeout leaves it unknown whether the credits landed, so a second send risks a duplicate.
  sisu_timeout: "recheck",

  // Deterministic rejections of what we sent: the same payload is refused the same way, so these
  // need someone to change the payload or the credentials, not another attempt.
  sisu_validation_failed: "support",
  unauthorized: "support",
  malformed_request: "support",

  misregistered: "support",
  acceptor_not_found: "support",
  course_not_allowed: "support",
  unknown: "support",
} as const satisfies Record<CreditRegistrationErrorCode, FailureRemedy>

const REMEDY_OWNERS = {
  module_configuration: "course_setup",
  student_number: "student",
  student_enrolment: "student",
  retry: "registry",
  recheck: "registry",
  support: "support",
} as const satisfies Record<FailureRemedy, FailureOwner>

/** An unclassifiable failure must not read as retryable: that is the one wrong answer here. */
const UNKNOWN_REMEDY: FailureRemedy = "support"

/**
 * What clears this failure. A missing code is treated as support's, not as retryable.
 *
 * Prefer `failureActions` in a page: it answers the same question in the form a page needs.
 */
export const failureRemedy = (
  errorCode: CreditRegistrationErrorCode | null | undefined,
): FailureRemedy =>
  (errorCode ? widenedLookup(FAILURE_REMEDIES, errorCode) : undefined) ?? UNKNOWN_REMEDY

/** Whose problem this failure is, for a surface that names the owner. */
export const failureOwner = (
  errorCode: CreditRegistrationErrorCode | null | undefined,
): FailureOwner => REMEDY_OWNERS[failureRemedy(errorCode)]

/** Reading order for a failure list grouped by owner: what the reader can do first. */
export const FAILURE_OWNERS: readonly FailureOwner[] = [
  "course_setup",
  "student",
  "registry",
  "support",
]

const PLANS = {
  module_configuration: {
    student: { primary: null, secondary: ["contact_support"] },
    teacher: { primary: "fix_module_configuration", secondary: ["contact_support"] },
    admin: { primary: "fix_module_configuration", secondary: [] },
  },
  student_number: {
    student: { primary: "check_own_student_number", secondary: ["contact_support"] },
    teacher: {
      primary: "email_student",
      secondary: ["resend_student_number_link", "contact_support"],
    },
    admin: {
      primary: "link_student_number_by_hand",
      secondary: ["resend_student_number_link"],
    },
  },
  student_enrolment: {
    student: { primary: "enrol", secondary: ["recheck_enrolment", "contact_support"] },
    teacher: { primary: "email_student", secondary: ["contact_support"] },
    admin: { primary: "email_student", secondary: [] },
  },
  retry: {
    student: { primary: null, secondary: ["contact_support"] },
    teacher: { primary: "retry", secondary: ["contact_support"] },
    admin: { primary: "retry", secondary: [] },
  },
  recheck: {
    student: { primary: null, secondary: ["contact_support"] },
    teacher: { primary: null, secondary: ["contact_support"] },
    admin: { primary: "recheck_registry", secondary: [] },
  },
  support: {
    student: { primary: null, secondary: ["contact_support"] },
    teacher: { primary: null, secondary: ["contact_support"] },
    admin: { primary: null, secondary: [] },
  },
} as const satisfies Record<
  FailureRemedy,
  Record<FailureAudience, { primary: FailureAction | null; secondary: readonly FailureAction[] }>
>

/**
 * The actions one reader may be offered about one failed registration.
 *
 * Says what could help, not what the server will accept: a row's `resubmission_refusal` and a
 * paused course module still veto a retry this plan permits. An admin's housekeeping actions
 * (dismiss the attention flag, cancel the registration) are not failure remedies and are not in
 * here; a page keeps those and puts them last.
 */
export const failureActions = (
  errorCode: CreditRegistrationErrorCode | null | undefined,
  audience: FailureAudience,
): FailureActionPlan => {
  const remedy = failureRemedy(errorCode)
  const plan = PLANS[remedy][audience]
  return { owner: REMEDY_OWNERS[remedy], remedy, primary: plan.primary, secondary: plan.secondary }
}

/**
 * Whether sending this registration to Sisu again could clear it.
 *
 * False for a timeout, whose outcome is unknown until someone checks: use `failureActions` to get
 * the check instead. Also false for a missing error code.
 */
export const canRetryFailure = (
  errorCode: CreditRegistrationErrorCode | null | undefined,
): boolean => failureRemedy(errorCode) === "retry"

/**
 * How many of these failures a retry could clear — the number a retry button may name.
 *
 * The total count of failures is not that number: most failures on a real course are somebody's to
 * fix rather than the registry's to accept.
 */
export const retryableFailureCount = (
  errorCodes: readonly (CreditRegistrationErrorCode | null | undefined)[],
): number => errorCodes.filter((errorCode) => canRetryFailure(errorCode)).length

const OWNER_LABEL_KEYS = {
  course_setup: "credit-registration-owner-course-setup",
  student: "credit-registration-owner-student",
  registry: "credit-registration-owner-registry",
  support: "credit-registration-owner-support",
} as const satisfies Record<FailureOwner, string>

const OWNER_HEADING_KEYS = {
  course_setup: "credit-registration-owner-heading-course-setup",
  student: "credit-registration-owner-heading-student",
  registry: "credit-registration-owner-heading-registry",
  support: "credit-registration-owner-heading-support",
} as const satisfies Record<FailureOwner, string>

/**
 * Whose problem it is, in the two words a "who fixes this" table cell has room for.
 *
 * For a heading over a group of failures use `failureOwnerHeading`, which says what to do rather
 * than naming the owner.
 */
export const failureOwnerLabel = (t: TFunction, owner: FailureOwner): string =>
  labelFrom(t, OWNER_LABEL_KEYS, owner, OWNER_LABEL_KEYS.support)

/** A heading over the failures one owner has to clear, in the imperative the reader can act on. */
export const failureOwnerHeading = (t: TFunction, owner: FailureOwner): string =>
  labelFrom(t, OWNER_HEADING_KEYS, owner, OWNER_HEADING_KEYS.support)

const ACTION_LABEL_KEYS = {
  retry: "credit-registration-action-label-retry",
  recheck_registry: "credit-registration-action-label-recheck-registry",
  fix_module_configuration: "credit-registration-action-label-fix-module-configuration",
  resend_student_number_link: "credit-registration-action-label-resend-student-number-link",
  link_student_number_by_hand: "credit-registration-action-label-link-student-number-by-hand",
  check_own_student_number: "credit-registration-action-label-check-own-student-number",
  enrol: "credit-registration-action-enrol",
  recheck_enrolment: "credit-registration-action-recheck-enrolment",
  email_student: "credit-registration-action-label-email-student",
  contact_support: "credit-registration-action-label-contact-support",
} as const satisfies Record<FailureAction, string>

/** The button label for an action, the same words on every surface that offers it. */
export const failureActionLabel = (t: TFunction, action: FailureAction): string =>
  labelFrom(t, ACTION_LABEL_KEYS, action, ACTION_LABEL_KEYS.contact_support)
