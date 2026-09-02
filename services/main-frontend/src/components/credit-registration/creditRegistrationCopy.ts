import type { TFunction } from "i18next"

import type {
  CreditRegistrationErrorCode,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import type { RegistrationStatusState, RegistrationStatusStep } from "@/shared-module/components"

import { labelFrom, widenedLookup } from "./labelFrom"

const STAGE_KEYS = [
  "credit-registration-stage-student-number",
  "credit-registration-stage-enrolment",
  "credit-registration-stage-registered",
] as const

type StageStates = readonly [
  RegistrationStatusState,
  RegistrationStatusState,
  RegistrationStatusState,
]

/** One row per status, each in `STAGE_KEYS` order. */
const STAGE_STATES = {
  waiting_for_completion: ["upcoming", "upcoming", "upcoming"],
  needs_student_number: ["action-needed", "upcoming", "upcoming"],
  in_progress: ["done", "current", "upcoming"],
  needs_enrolment: ["done", "action-needed", "upcoming"],
  waiting_for_sisu: ["done", "done", "current"],
  registered: ["done", "done", "done"],
  failed: ["done", "done", "failed"],
  not_registering: ["upcoming", "upcoming", "upcoming"],
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
  needs_student_number: "credit-registration-status-needs-student-number",
  in_progress: "credit-registration-status-in-progress",
  needs_enrolment: "credit-registration-status-needs-enrolment",
  waiting_for_sisu: "credit-registration-status-waiting-for-sisu",
  registered: "credit-registration-status-registered",
  failed: "credit-registration-status-failed",
  not_registering: "credit-registration-status-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

const STATUS_LABEL_UNKNOWN_KEY = "credit-registration-status-unknown"

const STATUS_EXPLANATION_KEYS = {
  waiting_for_completion: "credit-registration-explanation-waiting-for-completion",
  needs_student_number: "credit-registration-explanation-needs-student-number",
  in_progress: "credit-registration-explanation-in-progress",
  needs_enrolment: "credit-registration-explanation-needs-enrolment",
  waiting_for_sisu: "credit-registration-explanation-waiting-for-sisu",
  registered: "credit-registration-explanation-registered",
  failed: "credit-registration-explanation-failed",
  not_registering: "credit-registration-explanation-not-registering",
} as const satisfies Record<StudentFacingCreditRegistrationStatus, string>

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

export const registrationStatusLabel = (
  t: TFunction,
  status: StudentFacingCreditRegistrationStatus,
): string => labelFrom(t, STATUS_LABEL_KEYS, status, STATUS_LABEL_UNKNOWN_KEY)

const UNKNOWN_STAGE_STATES: StageStates = STAGE_STATES.waiting_for_completion

export const registrationStatusState = (
  status: StudentFacingCreditRegistrationStatus,
): RegistrationStatusState => {
  const stages = widenedLookup(STAGE_STATES, status) ?? UNKNOWN_STAGE_STATES
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
  const stages = widenedLookup(STAGE_STATES, status) ?? UNKNOWN_STAGE_STATES
  return STAGE_KEYS.map((key, index) => {
    const state = stages[index] ?? "upcoming"
    return { label: t(key), state, stateLabel: t(STATE_LABEL_KEYS[state]) }
  })
}

export const registrationExplanation = (
  t: TFunction,
  status: StudentFacingCreditRegistrationStatus,
): string =>
  labelFrom(t, STATUS_EXPLANATION_KEYS, status, STATUS_EXPLANATION_KEYS.waiting_for_completion)

/** Matches `grade_mapping.rs`: both spellings of the pass/fail scale are in circulation. */
const PASS_FAIL_GRADE_SCALE_IDS = ["sis-hyl-hyv", "sis-hyv-hyl"]
const PASS_GRADE_ID = "1"

/**
 * The grade as a student reads it. `grade_id` is the study registry's code, so on the pass/fail
 * scale it is "1" or "0" and showing it raw reads as a one or a zero out of five.
 */
export const registrationGradeLabel = (
  t: TFunction,
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
  t: TFunction,
  errorCode: CreditRegistrationErrorCode | null | undefined,
): string | null => (errorCode ? labelFrom(t, ERROR_CODE_KEYS, errorCode, GENERIC_ERROR_KEY) : null)
