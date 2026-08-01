import type { TFunction } from "i18next"

import type {
  CreditRegistrationErrorCode,
  CreditRegistrationState,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import type { RegistrationStatusState, RegistrationStatusStep } from "@/shared-module/components"

/** The four stages a student is shown, in order. */
const STAGE_KEYS = [
  "credit-registration-stage-consent",
  "credit-registration-stage-student-number",
  "credit-registration-stage-enrolment",
  "credit-registration-stage-registered",
] as const

type StageStates = readonly [
  RegistrationStatusState,
  RegistrationStatusState,
  RegistrationStatusState,
  RegistrationStatusState,
]

/**
 * How far each stage has got, per backend status. One row per status, in the same order as
 * `STAGE_KEYS`, so the stepper needs no per-status branching.
 *
 * The backend collapses eighteen ledger states onto these nine; nothing here re-derives that.
 */
const STAGE_STATES = {
  waiting_for_completion: ["upcoming", "upcoming", "upcoming", "upcoming"],
  needs_consent: ["action-needed", "upcoming", "upcoming", "upcoming"],
  needs_student_number: ["done", "action-needed", "upcoming", "upcoming"],
  in_progress: ["done", "done", "current", "upcoming"],
  needs_enrolment: ["done", "done", "action-needed", "upcoming"],
  waiting_for_sisu: ["done", "done", "done", "current"],
  registered: ["done", "done", "done", "done"],
  failed: ["done", "done", "done", "failed"],
  not_registering: ["upcoming", "upcoming", "upcoming", "upcoming"],
} as const satisfies Record<StudentFacingCreditRegistrationStatus, StageStates>

const STATE_LABEL_KEYS = {
  done: "credit-registration-step-state-done",
  current: "credit-registration-step-state-current",
  "action-needed": "credit-registration-step-state-action-needed",
  failed: "credit-registration-step-state-failed",
  upcoming: "credit-registration-step-state-upcoming",
} as const satisfies Record<RegistrationStatusState, string>

const STATUS_LABEL_KEYS = {
  waiting_for_completion: "credit-registration-status-waiting-for-completion",
  needs_consent: "credit-registration-status-needs-consent",
  needs_student_number: "credit-registration-status-needs-student-number",
  in_progress: "credit-registration-status-in-progress",
  needs_enrolment: "credit-registration-status-needs-enrolment",
  waiting_for_sisu: "credit-registration-status-waiting-for-sisu",
  registered: "credit-registration-status-registered",
  failed: "credit-registration-status-failed",
  not_registering: "credit-registration-status-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

const STATUS_EXPLANATION_KEYS = {
  waiting_for_completion: "credit-registration-explanation-waiting-for-completion",
  needs_consent: "credit-registration-explanation-needs-consent",
  needs_student_number: "credit-registration-explanation-needs-student-number",
  in_progress: "credit-registration-explanation-in-progress",
  needs_enrolment: "credit-registration-explanation-needs-enrolment",
  waiting_for_sisu: "credit-registration-explanation-waiting-for-sisu",
  registered: "credit-registration-explanation-registered",
  failed: "credit-registration-explanation-failed",
  not_registering: "credit-registration-explanation-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

/**
 * A student-facing sentence per error code. The study registry's own message is never rendered: it is
 * written for an integrator, may name a person, and is not translated.
 */
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

/** Anything the mapping above does not cover, including a code added after this build. */
const GENERIC_ERROR_KEY = "credit-registration-error-generic"

const WITHDRAWN_WHILE_IN_FLIGHT_KEY = "credit-registration-explanation-consent-withdrawn-in-flight"

type ErrorHelpKey = (typeof ERROR_CODE_KEYS)[CreditRegistrationErrorCode] | typeof GENERIC_ERROR_KEY

export const registrationStatusLabel = (
  t: TFunction,
  status: StudentFacingCreditRegistrationStatus,
): string => t(STATUS_LABEL_KEYS[status])

/** The state the badge shows: how the registration as a whole reads at a glance. */
export const registrationStatusState = (
  status: StudentFacingCreditRegistrationStatus,
): RegistrationStatusState => {
  const stages: StageStates = STAGE_STATES[status]
  if (status === "registered") {
    return "done"
  }
  if (stages.includes("failed")) {
    return "failed"
  }
  if (stages.includes("action-needed")) {
    return "action-needed"
  }
  if (stages.includes("current")) {
    return "current"
  }
  return "upcoming"
}

export const registrationStepperSteps = (
  t: TFunction,
  status: StudentFacingCreditRegistrationStatus,
): RegistrationStatusStep[] => {
  const stages: StageStates = STAGE_STATES[status]
  return [
    { label: t(STAGE_KEYS[0]), state: stages[0], stateLabel: t(STATE_LABEL_KEYS[stages[0]]) },
    { label: t(STAGE_KEYS[1]), state: stages[1], stateLabel: t(STATE_LABEL_KEYS[stages[1]]) },
    { label: t(STAGE_KEYS[2]), state: stages[2], stateLabel: t(STATE_LABEL_KEYS[stages[2]]) },
    { label: t(STAGE_KEYS[3]), state: stages[3], stateLabel: t(STATE_LABEL_KEYS[stages[3]]) },
  ]
}

/**
 * The sentence explaining where the registration stands. Withdrawal that caught an already-sent
 * import is the one place we admit an unknown outcome, so it does not share `not_registering`'s copy.
 */
export const registrationExplanation = (
  t: TFunction,
  status: StudentFacingCreditRegistrationStatus,
  state: CreditRegistrationState,
): string =>
  state === "abandoned_by_consent_withdrawal"
    ? t(WITHDRAWN_WHILE_IN_FLIGHT_KEY)
    : t(STATUS_EXPLANATION_KEYS[status])

export const registrationErrorHelp = (
  t: TFunction,
  errorCode: CreditRegistrationErrorCode | null | undefined,
): string | null => {
  if (!errorCode) {
    return null
  }
  // Widened on purpose: a code the backend gains after this build arrives as a string with no entry.
  const mapped = (ERROR_CODE_KEYS as Record<string, ErrorHelpKey | undefined>)[errorCode]
  return t(mapped ?? GENERIC_ERROR_KEY)
}
