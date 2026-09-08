import type {
  CreditRegistrationErrorCode,
  CreditRegistrationPendingReason,
  CreditRegistrationState,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import type { RegistrationStatusState } from "@/shared-module/components"

import type { CreditRegistrationTFunction } from "./constants"
import { labelFrom, widenedLookup } from "./labelFrom"

const STATUS_STATES = {
  waiting_for_completion: "upcoming",
  needs_student_number: "action-needed",
  looking_for_enrolment: "current",
  sending: "current",
  needs_enrolment: "action-needed",
  waiting_for_sisu: "current",
  registered: "done",
  failed: "failed",
  not_registering: "upcoming",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, RegistrationStatusState>

const STATUS_LABEL_KEYS = {
  waiting_for_completion: "credit-registration-status-waiting-for-completion",
  needs_student_number: "credit-registration-status-needs-student-number",
  looking_for_enrolment: "credit-registration-status-looking-for-enrolment",
  sending: "credit-registration-status-sending",
  needs_enrolment: "credit-registration-status-needs-enrolment",
  waiting_for_sisu: "credit-registration-status-waiting-for-sisu",
  registered: "credit-registration-status-registered",
  failed: "credit-registration-status-failed",
  not_registering: "credit-registration-status-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

const STATUS_LABEL_UNKNOWN_KEY = "credit-registration-status-unknown"

/** The same states named for someone reading about another person, and short enough for a column. */
const TEACHER_STATUS_LABEL_KEYS = {
  waiting_for_completion: "credit-registration-teacher-status-waiting-for-completion",
  needs_student_number: "credit-registration-teacher-status-needs-student-number",
  looking_for_enrolment: "credit-registration-teacher-status-looking-for-enrolment",
  sending: "credit-registration-teacher-status-sending",
  needs_enrolment: "credit-registration-teacher-status-needs-enrolment",
  waiting_for_sisu: "credit-registration-teacher-status-waiting-for-sisu",
  registered: "credit-registration-teacher-status-registered",
  failed: "credit-registration-teacher-status-failed",
  not_registering: "credit-registration-teacher-status-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

const TEACHER_STATUS_LABEL_UNKNOWN_KEY = "credit-registration-teacher-status-unknown"

const STATUS_EXPLANATION_KEYS = {
  waiting_for_completion: "credit-registration-explanation-waiting-for-completion",
  needs_student_number: "credit-registration-explanation-needs-student-number",
  looking_for_enrolment: "credit-registration-explanation-looking-for-enrolment",
  sending: "credit-registration-explanation-sending",
  needs_enrolment: "credit-registration-explanation-needs-enrolment",
  waiting_for_sisu: "credit-registration-explanation-waiting-for-sisu",
  registered: "credit-registration-explanation-registered",
  failed: "credit-registration-explanation-failed",
  not_registering: "credit-registration-explanation-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

const TEACHER_STATUS_EXPLANATION_KEYS = {
  waiting_for_completion: "credit-registration-teacher-explanation-waiting-for-completion",
  needs_student_number: "credit-registration-teacher-explanation-needs-student-number",
  looking_for_enrolment: "credit-registration-teacher-explanation-looking-for-enrolment",
  sending: "credit-registration-teacher-explanation-sending",
  needs_enrolment: "credit-registration-teacher-explanation-needs-enrolment",
  waiting_for_sisu: "credit-registration-teacher-explanation-waiting-for-sisu",
  registered: "credit-registration-teacher-explanation-registered",
  failed: "credit-registration-teacher-explanation-failed",
  not_registering: "credit-registration-teacher-explanation-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

const TEACHER_STATUS_EXPLANATION_UNKNOWN_KEY = "credit-registration-teacher-explanation-unknown"

/** The study registry's own message is never shown: it is untranslated and may name a person. */
const ERROR_CODE_KEYS = {
  person_not_found: "credit-registration-error-person-not-found",
  course_code_not_found: "credit-registration-error-course-code-not-found",
  enrolment_not_found: "credit-registration-error-enrolment-not-found",
  enrolment_not_accepted: "credit-registration-error-enrolment-not-accepted",
  invalid_grade_for_grade_scale: "credit-registration-error-invalid-grade-for-grade-scale",
  course_not_allowed: "credit-registration-error-course-not-allowed",
  invalid_credits: "credit-registration-error-invalid-credits",
  study_right_not_valid: "credit-registration-error-study-right-not-valid",
  acceptor_not_found: "credit-registration-error-acceptor-not-found",
  sisu_validation_failed: "credit-registration-error-sisu-validation-failed",
  sisu_timeout: "credit-registration-error-sisu-timeout",
  sisu_temporarily_unavailable: "credit-registration-error-sisu-temporarily-unavailable",
  misregistered: "credit-registration-error-misregistered",
  unauthorized: "credit-registration-error-unauthorized",
  malformed_request: "credit-registration-error-malformed-request",
  transport_error: "credit-registration-error-transport-error",
  unexpected_response: "credit-registration-error-unexpected-response",
  no_grade_scale_mapping: "credit-registration-error-no-grade-scale-mapping",
  missing_uh_course_code: "credit-registration-error-missing-uh-course-code",
  missing_ects_credits: "credit-registration-error-missing-ects-credits",
  retry_window_expired: "credit-registration-error-retry-window-expired",
  unknown: "credit-registration-error-generic",
} as const satisfies Record<CreditRegistrationErrorCode, string>

const GENERIC_ERROR_KEY = "credit-registration-error-generic"

/** Third person, and every sentence ends with who acts — see `registrationFailures` for the owner. */
const TEACHER_ERROR_CODE_KEYS = {
  person_not_found: "credit-registration-teacher-error-person-not-found",
  course_code_not_found: "credit-registration-teacher-error-course-code-not-found",
  enrolment_not_found: "credit-registration-teacher-error-enrolment-not-found",
  enrolment_not_accepted: "credit-registration-teacher-error-enrolment-not-accepted",
  invalid_grade_for_grade_scale: "credit-registration-teacher-error-invalid-grade-for-grade-scale",
  course_not_allowed: "credit-registration-teacher-error-course-not-allowed",
  invalid_credits: "credit-registration-teacher-error-invalid-credits",
  study_right_not_valid: "credit-registration-teacher-error-study-right-not-valid",
  acceptor_not_found: "credit-registration-teacher-error-acceptor-not-found",
  sisu_validation_failed: "credit-registration-teacher-error-sisu-validation-failed",
  sisu_timeout: "credit-registration-teacher-error-sisu-timeout",
  sisu_temporarily_unavailable: "credit-registration-teacher-error-sisu-temporarily-unavailable",
  misregistered: "credit-registration-teacher-error-misregistered",
  unauthorized: "credit-registration-teacher-error-unauthorized",
  malformed_request: "credit-registration-teacher-error-malformed-request",
  transport_error: "credit-registration-teacher-error-transport-error",
  unexpected_response: "credit-registration-teacher-error-unexpected-response",
  no_grade_scale_mapping: "credit-registration-teacher-error-no-grade-scale-mapping",
  missing_uh_course_code: "credit-registration-teacher-error-missing-uh-course-code",
  missing_ects_credits: "credit-registration-teacher-error-missing-ects-credits",
  retry_window_expired: "credit-registration-teacher-error-retry-window-expired",
  unknown: "credit-registration-teacher-error-unknown",
} as const satisfies Record<CreditRegistrationErrorCode, string>

const TEACHER_ERROR_UNKNOWN_KEY = "credit-registration-teacher-error-unknown"

/** The same failures named in two or three words, short enough for a table cell or a chip. */
const ERROR_CODE_SHORT_KEYS = {
  person_not_found: "credit-registration-reason-person-not-found",
  course_code_not_found: "credit-registration-reason-course-code-not-found",
  enrolment_not_found: "credit-registration-reason-enrolment-not-found",
  enrolment_not_accepted: "credit-registration-reason-enrolment-not-accepted",
  invalid_grade_for_grade_scale: "credit-registration-reason-invalid-grade-for-grade-scale",
  course_not_allowed: "credit-registration-reason-course-not-allowed",
  invalid_credits: "credit-registration-reason-invalid-credits",
  study_right_not_valid: "credit-registration-reason-study-right-not-valid",
  acceptor_not_found: "credit-registration-reason-acceptor-not-found",
  sisu_validation_failed: "credit-registration-reason-sisu-validation-failed",
  sisu_timeout: "credit-registration-reason-sisu-timeout",
  sisu_temporarily_unavailable: "credit-registration-reason-sisu-temporarily-unavailable",
  misregistered: "credit-registration-reason-misregistered",
  unauthorized: "credit-registration-reason-unauthorized",
  malformed_request: "credit-registration-reason-malformed-request",
  transport_error: "credit-registration-reason-transport-error",
  unexpected_response: "credit-registration-reason-unexpected-response",
  no_grade_scale_mapping: "credit-registration-reason-no-grade-scale-mapping",
  missing_uh_course_code: "credit-registration-reason-missing-uh-course-code",
  missing_ects_credits: "credit-registration-reason-missing-ects-credits",
  retry_window_expired: "credit-registration-reason-retry-window-expired",
  unknown: "credit-registration-reason-unknown",
} as const satisfies Record<CreditRegistrationErrorCode, string>

const SHORT_REASON_UNKNOWN_KEY = "credit-registration-reason-unknown"

export const registrationStatusLabel = (
  t: CreditRegistrationTFunction,
  status: StudentFacingCreditRegistrationStatus,
): string => labelFrom(t, STATUS_LABEL_KEYS, status, STATUS_LABEL_UNKNOWN_KEY)

/**
 * The status as a teacher or an administrator reads it: third person, and short enough for a
 * roster column.
 *
 * Not `registrationStatusLabel`, which is written for the student the registration belongs to and
 * says "your" on surfaces where that is somebody else.
 */
export const registrationStatusTeacherLabel = (
  t: CreditRegistrationTFunction,
  status: StudentFacingCreditRegistrationStatus,
): string => labelFrom(t, TEACHER_STATUS_LABEL_KEYS, status, TEACHER_STATUS_LABEL_UNKNOWN_KEY)

/** A status this client does not know reads as not started, never as done. */
const UNKNOWN_STATUS_STATE: RegistrationStatusState = "upcoming"

export const registrationStatusState = (
  status: StudentFacingCreditRegistrationStatus,
): RegistrationStatusState => widenedLookup(STATUS_STATES, status) ?? UNKNOWN_STATUS_STATE

/**
 * Whether the registration is stalled on something the student or the course staff can still do.
 *
 * Derived from the status-to-state map, so a status added there cannot silently drop out of the
 * student's attention list or the teacher's "needs attention" filter.
 */
export const registrationNeedsAttention = (
  status: StudentFacingCreditRegistrationStatus,
): boolean => {
  const state = registrationStatusState(status)
  return state === "action-needed" || state === "failed"
}

/** Every student-facing status, so a caller deriving a set from them cannot miss a new one. */
export const ALL_REGISTRATION_STATUSES = Object.keys(
  STATUS_STATES,
) as StudentFacingCreditRegistrationStatus[]

export const registrationExplanation = (
  t: CreditRegistrationTFunction,
  status: StudentFacingCreditRegistrationStatus,
): string =>
  labelFrom(t, STATUS_EXPLANATION_KEYS, status, STATUS_EXPLANATION_KEYS.waiting_for_completion)

/**
 * What the status means, for a teacher or an administrator looking at somebody else's
 * registration.
 *
 * Not `registrationExplanation`, which addresses the student directly.
 */
export const registrationTeacherExplanation = (
  t: CreditRegistrationTFunction,
  status: StudentFacingCreditRegistrationStatus,
): string =>
  labelFrom(t, TEACHER_STATUS_EXPLANATION_KEYS, status, TEACHER_STATUS_EXPLANATION_UNKNOWN_KEY)

/** Matches `grade_mapping.rs`: both spellings of the pass/fail scale are in circulation. */
const PASS_FAIL_GRADE_SCALE_IDS = ["sis-hyl-hyv", "sis-hyv-hyl"]
const PASS_GRADE_ID = "1"

/**
 * The grade as a student reads it. `grade_id` is the study registry's code, so on the pass/fail
 * scale it is "1" or "0" and showing it raw reads as a one or a zero out of five.
 */
export const registrationGradeLabel = (
  t: CreditRegistrationTFunction,
  gradeId: string | null | undefined,
  gradeScaleId: string | null | undefined,
): string => {
  if (!gradeId) {
    return t("unknown-grade")
  }
  if (gradeScaleId && PASS_FAIL_GRADE_SCALE_IDS.includes(gradeScaleId)) {
    return gradeId === PASS_GRADE_ID ? t("grade-pass") : t("grade-fail")
  }
  return gradeId
}

export const registrationErrorHelp = (
  t: CreditRegistrationTFunction,
  errorCode: CreditRegistrationErrorCode | null | undefined,
): string | null => (errorCode ? labelFrom(t, ERROR_CODE_KEYS, errorCode, GENERIC_ERROR_KEY) : null)

/**
 * Why the registration failed and who has to act, for a teacher looking at somebody else's
 * registration.
 *
 * Not `registrationErrorHelp`, which is addressed to the student it happened to and tells them to
 * contact support — the teacher is the support the student was told to contact. Pair it with
 * `failureActions` so the buttons match the sentence.
 */
export const registrationErrorTeacherHelp = (
  t: CreditRegistrationTFunction,
  errorCode: CreditRegistrationErrorCode | null | undefined,
): string | null =>
  errorCode ? labelFrom(t, TEACHER_ERROR_CODE_KEYS, errorCode, TEACHER_ERROR_UNKNOWN_KEY) : null

/**
 * Why the registration failed, in the two or three words a roster cell or a breakdown chip has
 * room for.
 *
 * Not `registrationErrorHelp`, which is the full sentence written for the student it happened to;
 * this one only tells failures apart at a glance, so keep the sentence wherever there is room.
 */
export const registrationErrorShortLabel = (
  t: CreditRegistrationTFunction,
  errorCode: CreditRegistrationErrorCode | null | undefined,
): string | null =>
  errorCode ? labelFrom(t, ERROR_CODE_SHORT_KEYS, errorCode, SHORT_REASON_UNKNOWN_KEY) : null

const LEDGER_STATE_KEYS = {
  pending: "credit-registration-ledger-state-pending",
  ready_to_submit: "credit-registration-ledger-state-ready-to-submit",
  resolving_enrolment: "credit-registration-ledger-state-resolving-enrolment",
  checking_enrolment: "credit-registration-ledger-state-checking-enrolment",
  no_usable_enrolment: "credit-registration-ledger-state-no-usable-enrolment",
  submitting: "credit-registration-ledger-state-submitting",
  submission_uncertain: "credit-registration-ledger-state-submission-uncertain",
  awaiting_verification: "credit-registration-ledger-state-awaiting-verification",
  registered: "credit-registration-ledger-state-registered",
  duplicate: "credit-registration-ledger-state-duplicate",
  not_improved: "credit-registration-ledger-state-not-improved",
  misregistered: "credit-registration-ledger-state-misregistered",
  failed_retryable: "credit-registration-ledger-state-failed-retryable",
  failed_permanent: "credit-registration-ledger-state-failed-permanent",
  blocked: "credit-registration-ledger-state-blocked",
  cancelled: "credit-registration-ledger-state-cancelled",
} as const satisfies Record<CreditRegistrationState, string>

const LEDGER_STATE_UNKNOWN_KEY = "credit-registration-ledger-state-unknown"

/** `pending` alone does not say what the row is waiting for, and the two waits are unrelated. */
const PENDING_REASON_STATE_KEYS = {
  completion: "credit-registration-ledger-state-pending-completion",
  student_number: "credit-registration-ledger-state-pending-student-number",
} as const satisfies Record<CreditRegistrationPendingReason, string>

const LEDGER_STATES = Object.keys(LEDGER_STATE_KEYS) as CreditRegistrationState[]

/** Lets a caller holding an opaque backend string decide whether it names a state. */
export const isLedgerState = (value: string): value is CreditRegistrationState =>
  (LEDGER_STATES as string[]).includes(value)

/**
 * One stored state in words, for every badge, column, chart title and select option that shows
 * one. The wire name stays quotable beside it — an operator reporting a row to support quotes the
 * token, not the label.
 *
 * `pendingReason` only matters for `pending`, which otherwise does not say what the row waits for.
 * Not `registrationStatusLabel`, which names the collapsed stage the student is shown.
 */
export const registrationLedgerStateLabel = (
  t: CreditRegistrationTFunction,
  state: CreditRegistrationState,
  pendingReason?: CreditRegistrationPendingReason | null,
): string =>
  state === "pending" && pendingReason
    ? labelFrom(t, PENDING_REASON_STATE_KEYS, pendingReason, LEDGER_STATE_KEYS.pending)
    : labelFrom(t, LEDGER_STATE_KEYS, state, LEDGER_STATE_UNKNOWN_KEY)
