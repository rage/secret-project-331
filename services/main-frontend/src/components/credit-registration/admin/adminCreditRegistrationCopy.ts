import type { TFunction } from "i18next"

import type {
  AdminManualLinkOutcome,
  CreditRegistrationAdminAction,
  CreditRegistrationAdminActionTarget,
  CreditRegistrationAlertId,
  CreditRegistrationAttentionReason,
  CreditRegistrationErrorCode,
  CreditRegistrationEventKind,
  CreditRegistrationPendingReason,
  CreditRegistrationState,
  EmailSendStatus,
  ResendOutcome,
  Retryability,
  StudentNumberVerificationMethod,
} from "@/generated/api/types.generated"
import type { BadgeTone, RegistrationStatusState } from "@/shared-module/components"

import { TONE } from "../constants"
import {
  isLedgerState,
  registrationErrorShortLabel,
  registrationLedgerStateLabel,
} from "../creditRegistrationCopy"
import { labelFrom, translateKey, widenedLookup } from "../labelFrom"

export {
  notificationEmailLabel as notificationKindLabel,
  studentNumberVerificationLabel as verificationMethodLabel,
} from "../teacherCreditRegistrations"

/**
 * How much the link is worth as proof. The automatic match is the weakest: nobody confirmed
 * anything, an address just lined up — which is what the name-mismatch alert is about.
 */
const VERIFICATION_METHOD_TONES = {
  emailed_link: TONE.SUCCESS,
  email_match_fast_track: TONE.INFO,
  admin_manual: TONE.NEUTRAL,
} as const satisfies Record<StudentNumberVerificationMethod, BadgeTone>

export const verificationMethodTone = (
  method: StudentNumberVerificationMethod | null | undefined,
): BadgeTone =>
  method ? (widenedLookup(VERIFICATION_METHOD_TONES, method) ?? TONE.NEUTRAL) : TONE.NEUTRAL

const STATE_TONES = {
  pending: "upcoming",
  ready_to_submit: "current",
  resolving_enrolment: "current",
  checking_enrolment: "current",
  no_usable_enrolment: "action-needed",
  submitting: "current",
  submission_uncertain: "action-needed",
  awaiting_verification: "current",
  registered: "done",
  duplicate: "done",
  not_improved: "done",
  misregistered: "failed",
  failed_retryable: "action-needed",
  failed_permanent: "failed",
  blocked: "upcoming",
  cancelled: "upcoming",
} as const satisfies Record<CreditRegistrationState, RegistrationStatusState>

/** A `pending` row waiting on the student is the admin's problem; one waiting on a completion is not. */
const PENDING_REASON_TONES = {
  completion: "upcoming",
  student_number: "action-needed",
} as const satisfies Record<CreditRegistrationPendingReason, RegistrationStatusState>

export const stateTone = (
  state: CreditRegistrationState,
  pendingReason?: CreditRegistrationPendingReason | null,
): RegistrationStatusState =>
  (pendingReason ? widenedLookup(PENDING_REASON_TONES, pendingReason) : undefined) ??
  widenedLookup(STATE_TONES, state) ??
  "upcoming"

/** Each sentence: what Sisu said, what it usually means, what fixes it. */
const ADMIN_ERROR_CODE_KEYS = {
  person_not_found: "credit-registration-admin-error-person-not-found",
  course_code_not_found: "credit-registration-admin-error-course-code-not-found",
  enrolment_not_found: "credit-registration-admin-error-enrolment-not-found",
  enrolment_not_accepted: "credit-registration-admin-error-enrolment-not-accepted",
  invalid_grade_for_grade_scale: "credit-registration-admin-error-invalid-grade-for-grade-scale",
  course_not_allowed: "credit-registration-admin-error-course-not-allowed",
  invalid_credits: "credit-registration-admin-error-invalid-credits",
  study_right_not_valid: "credit-registration-admin-error-study-right-not-valid",
  acceptor_not_found: "credit-registration-admin-error-acceptor-not-found",
  sisu_validation_failed: "credit-registration-admin-error-sisu-validation-failed",
  sisu_timeout: "credit-registration-admin-error-sisu-timeout",
  sisu_temporarily_unavailable: "credit-registration-admin-error-sisu-temporarily-unavailable",
  misregistered: "credit-registration-admin-error-misregistered",
  unauthorized: "credit-registration-admin-error-unauthorized",
  malformed_request: "credit-registration-admin-error-malformed-request",
  transport_error: "credit-registration-admin-error-transport-error",
  unexpected_response: "credit-registration-admin-error-unexpected-response",
  no_grade_scale_mapping: "credit-registration-admin-error-no-grade-scale-mapping",
  missing_uh_course_code: "credit-registration-admin-error-missing-uh-course-code",
  missing_ects_credits: "credit-registration-admin-error-missing-ects-credits",
  retry_window_expired: "credit-registration-admin-error-retry-window-expired",
  unknown: "credit-registration-admin-error-unknown",
} as const satisfies Record<CreditRegistrationErrorCode, string>

const ADMIN_ERROR_UNKNOWN_KEY = "credit-registration-admin-error-unknown"

/**
 * The two codes whose sentence names the value Sisu rejected. Without the value the sentence still
 * has to read, so each has a variant that refers to it rather than quoting it.
 */
const ADMIN_ERROR_KEYS_WITHOUT_VALUE = {
  person_not_found: "credit-registration-admin-error-person-not-found-no-number",
  course_code_not_found: "credit-registration-admin-error-course-code-not-found-no-code",
} as const satisfies Partial<Record<CreditRegistrationErrorCode, string>>

/** What the registration carried, so the sentence can quote the value Sisu rejected. */
export interface AdminErrorSubject {
  studentNumber?: string | null
  courseCode?: string | null
}

const adminErrorKey = (
  errorCode: CreditRegistrationErrorCode,
  subject: AdminErrorSubject | undefined,
): string => {
  const value = errorCode === "person_not_found" ? subject?.studentNumber : subject?.courseCode
  return (
    (value ? undefined : widenedLookup(ADMIN_ERROR_KEYS_WITHOUT_VALUE, errorCode)) ??
    widenedLookup(ADMIN_ERROR_CODE_KEYS, errorCode) ??
    ADMIN_ERROR_UNKNOWN_KEY
  )
}

/**
 * Why the registration failed, for the administrator who has to decide what to do about it.
 *
 * Not `registrationErrorHelp`, which is written to the student and ends by telling them to contact
 * support — the reader here is support. `subject` only matters for `person_not_found` and
 * `course_code_not_found`, whose sentences quote the value Sisu rejected.
 */
export const registrationErrorAdminHelp = (
  t: TFunction,
  errorCode: CreditRegistrationErrorCode | null | undefined,
  subject?: AdminErrorSubject,
): string | null => {
  if (!errorCode) {
    return null
  }
  return translateKey(t, adminErrorKey(errorCode, subject), {
    studentNumber: subject?.studentNumber ?? "",
    courseCode: subject?.courseCode ?? "",
  })
}

const EVENT_KIND_KEYS = {
  created: "credit-registration-admin-event-created",
  state_changed: "credit-registration-admin-event-state-changed",
  suotar_response: "credit-registration-admin-event-suotar-response",
  retry_scheduled: "credit-registration-admin-event-retry-scheduled",
  admin_action: "credit-registration-admin-event-admin-action",
  student_action: "credit-registration-admin-event-student-action",
  cancelled: "credit-registration-admin-event-cancelled",
} as const satisfies Record<CreditRegistrationEventKind, string>

const EVENT_KIND_UNKNOWN_KEY = "credit-registration-admin-event-unknown"

/** What kind of thing the timeline entry records. */
export const eventKindLabel = (t: TFunction, kind: CreditRegistrationEventKind): string =>
  labelFrom(t, EVENT_KIND_KEYS, kind, EVENT_KIND_UNKNOWN_KEY)

export const COURSE_TEACHER_ROLE = "course_teacher"
export const GLOBAL_ADMIN_ROLE = "global_admin"

/** Whose permission authorised the action. The backend types the role as a bare string. */
export const actorRoleLabel = (t: TFunction, actorRole: string): string =>
  actorRole === COURSE_TEACHER_ROLE
    ? t("credit-registration-admin-actor-course-teacher")
    : t("credit-registration-admin-actor-global-admin")

const ALERT_KEYS = {
  credentials_rejected: "credit-registration-alert-credentials-rejected",
  study_registry_unreachable: "credit-registration-alert-study-registry-unreachable",
  sisu_unavailable: "credit-registration-alert-sisu-unavailable",
  stuck_registrations: "credit-registration-alert-stuck-registrations",
  linking_mail_send_failed: "credit-registration-alert-linking-mail-send-failed",
  linking_mail_rate_cap_exceeded: "credit-registration-alert-linking-mail-rate-cap-exceeded",
  phase_heartbeat_stale: "credit-registration-alert-phase-heartbeat-stale",
  phase_failing: "credit-registration-alert-phase-failing",
  permanent_failures_accumulating: "credit-registration-alert-permanent-failures-accumulating",
  misregistrations_detected: "credit-registration-alert-misregistrations-detected",
  course_configuration_broken: "credit-registration-alert-course-configuration-broken",
  pipeline_idle: "credit-registration-alert-pipeline-idle",
  completions_never_entered: "credit-registration-alert-completions-never-entered",
  confirmation_latency_regressed: "credit-registration-alert-confirmation-latency-regressed",
  fast_track_name_mismatch: "credit-registration-alert-fast-track-name-mismatch",
  pipeline_paused_globally: "credit-registration-alert-pipeline-paused-globally",
} as const satisfies Record<CreditRegistrationAlertId, string>

const GENERIC_ALERT_KEY = "credit-registration-alert-generic"

/**
 * One alert as the sentence the banner links.
 *
 * `subject` is whatever the backend named as the commonest cause — a state, a mail domain, a phase.
 * A state is translated on the way in, so the banner never shows a wire name; anything else is
 * passed through as the backend wrote it.
 */
export const alertSentence = (
  t: TFunction,
  id: CreditRegistrationAlertId,
  count: number,
  subject: string | null | undefined,
  total: number | null | undefined,
): string =>
  labelFrom(t, ALERT_KEYS, id, GENERIC_ALERT_KEY, {
    count,
    subject:
      subject && isLedgerState(subject)
        ? registrationLedgerStateLabel(t, subject)
        : (subject ?? ""),
    total: total ?? 0,
  })

const ATTENTION_REASON_KEYS = {
  stuck_in_state: "credit-registration-admin-reason-stuck-in-state",
  permanent_error: "credit-registration-admin-reason-permanent-error",
  retry_window_expired: "credit-registration-admin-reason-retry-window-expired",
  misregistered: "credit-registration-admin-reason-misregistered",
  too_many_attempts: "credit-registration-admin-reason-too-many-attempts",
  outcome_uncertain: "credit-registration-admin-reason-outcome-uncertain",
} as const satisfies Record<CreditRegistrationAttentionReason, string>

const ATTENTION_REASON_UNKNOWN_KEY = "credit-registration-admin-reason-unknown"

// Derived from the copy table so a new reason can't reach the filter without a label.
const ATTENTION_REASONS = Object.keys(ATTENTION_REASON_KEYS) as CreditRegistrationAttentionReason[]

export const isAttentionReason = (
  value: string | undefined,
): value is CreditRegistrationAttentionReason =>
  value !== undefined && (ATTENTION_REASONS as string[]).includes(value)

/** Which detector put a row on the attention table. */
export const attentionReasonLabel = (
  t: TFunction,
  reason: CreditRegistrationAttentionReason,
): string => labelFrom(t, ATTENTION_REASON_KEYS, reason, ATTENTION_REASON_UNKNOWN_KEY)

/**
 * The error's short label beside a state badge, or `null` when it would just repeat the badge
 * (e.g. a misregistered row's error label and state label are the same sentence).
 */
export const registrationErrorNote = (
  t: TFunction,
  state: CreditRegistrationState,
  errorCode: CreditRegistrationErrorCode | null | undefined,
  pendingReason?: CreditRegistrationPendingReason | null,
): string | null => {
  const errorLabel = registrationErrorShortLabel(t, errorCode)
  if (errorLabel === null) {
    return null
  }
  return errorLabel === registrationLedgerStateLabel(t, state, pendingReason) ? null : errorLabel
}

const RETRYABILITY_KEYS = {
  retryable_transient: "credit-registration-admin-retryability-transient",
  verify_only: "credit-registration-admin-retryability-verify-only",
  permanent_needs_student: "credit-registration-admin-retryability-needs-student",
  permanent_needs_admin: "credit-registration-admin-retryability-needs-admin",
  permanent_needs_config: "credit-registration-admin-retryability-needs-config",
} as const satisfies Record<Retryability, string>

const RETRYABILITY_UNKNOWN_KEY = "credit-registration-admin-retryability-unknown"

/** What can be done about an error code, which is the difference between waiting and fixing. */
export const retryabilityLabel = (t: TFunction, retryability: Retryability): string =>
  labelFrom(t, RETRYABILITY_KEYS, retryability, RETRYABILITY_UNKNOWN_KEY)

const RETRYABILITY_TONES = {
  retryable_transient: TONE.NEUTRAL,
  verify_only: TONE.NEUTRAL,
  permanent_needs_student: TONE.WARNING,
  permanent_needs_admin: TONE.DANGER,
  permanent_needs_config: TONE.DANGER,
} as const satisfies Record<Retryability, BadgeTone>

/** The badge tone beside `retryabilityLabel`. */
export const retryabilityTone = (retryability: Retryability): BadgeTone =>
  widenedLookup(RETRYABILITY_TONES, retryability) ?? TONE.NEUTRAL

export const ADMIN_ACTION_KEYS = {
  retry_item: "credit-registration-admin-action-retry-item",
  retry_failed_for_course: "credit-registration-admin-action-retry-failed-for-course",
  force_recheck: "credit-registration-admin-action-force-recheck",
  mark_resolved: "credit-registration-admin-action-mark-resolved",
  requeue_batch: "credit-registration-admin-action-requeue-batch",
  transition_item: "credit-registration-admin-action-transition-item",
  cancel_registration: "credit-registration-admin-action-cancel-registration",
  pause_course_module: "credit-registration-admin-action-pause-course-module",
  resume_course_module: "credit-registration-admin-action-resume-course-module",
  pause_phase: "credit-registration-admin-action-pause-phase",
  resume_phase: "credit-registration-admin-action-resume-phase",
  run_phase_now: "credit-registration-admin-action-run-phase-now",
  resend_link_email: "credit-registration-admin-action-resend-link-email",
  unlink_student_number: "credit-registration-admin-action-unlink-student-number",
  manual_link_student_number: "credit-registration-admin-action-manual-link-student-number",
  override_rate_cap: "credit-registration-admin-action-override-rate-cap",
} as const satisfies Record<CreditRegistrationAdminAction, string>

const ADMIN_ACTION_UNKNOWN_KEY = "credit-registration-admin-action-unknown"

export const adminActionLabel = (t: TFunction, action: CreditRegistrationAdminAction): string =>
  labelFrom(t, ADMIN_ACTION_KEYS, action, ADMIN_ACTION_UNKNOWN_KEY)

export const ADMIN_TARGET_KEYS = {
  credit_registration: "credit-registration-admin-action-target-registration",
  course_module: "credit-registration-admin-action-target-course-module",
  course: "credit-registration-admin-action-target-course",
  phase: "credit-registration-admin-action-target-phase",
  verified_student_number: "credit-registration-admin-action-target-verified-student-number",
  student_number_verification_token: "credit-registration-admin-action-target-token",
} as const satisfies Record<CreditRegistrationAdminActionTarget, string>

const ADMIN_TARGET_UNKNOWN_KEY = "credit-registration-admin-action-target-unknown"

export const adminActionTargetLabel = (
  t: TFunction,
  target: CreditRegistrationAdminActionTarget,
): string => labelFrom(t, ADMIN_TARGET_KEYS, target, ADMIN_TARGET_UNKNOWN_KEY)

const SEND_STATUS_KEYS = {
  queued: "credit-registration-admin-send-status-queued",
  retrying: "credit-registration-admin-send-status-retrying",
  sent: "credit-registration-admin-send-status-sent",
  send_failed: "credit-registration-admin-send-status-send-failed",
} as const satisfies Record<EmailSendStatus, string>

const SEND_STATUS_UNKNOWN_KEY = "credit-registration-admin-send-status-unknown"

/** Our send status only, never a delivery; an unknown status must not read as `queued`. */
export const sendStatusLabel = (t: TFunction, status: EmailSendStatus): string =>
  labelFrom(t, SEND_STATUS_KEYS, status, SEND_STATUS_UNKNOWN_KEY)

/** `Partial`: `no_student_number_known` is the teacher endpoint's, whose target may never have held one. */
const RESEND_OUTCOME_KEYS = {
  queued: "credit-registration-admin-resend-queued",
  already_mailed_to_every_known_address: "credit-registration-admin-resend-already-mailed",
  refused_by_rate_cap: "credit-registration-admin-resend-refused-by-rate-cap",
  no_address_in_study_registry: "credit-registration-admin-resend-no-address",
  not_on_the_course_roster: "credit-registration-admin-resend-not-on-roster",
  already_linked: "credit-registration-admin-resend-already-linked",
  study_registry_unavailable: "credit-registration-admin-resend-registry-unavailable",
} as const satisfies Partial<Record<ResendOutcome, string>>

const RESEND_OUTCOME_UNKNOWN_KEY = "credit-registration-admin-resend-unknown-outcome"

/** An unrecognised outcome must not fall back to `queued`: that reads as the resend having worked. */
export const resendOutcomeLabel = (t: TFunction, outcome: ResendOutcome): string =>
  labelFrom(t, RESEND_OUTCOME_KEYS, outcome, RESEND_OUTCOME_UNKNOWN_KEY)

const MANUAL_LINK_OUTCOME_KEYS = {
  linked: "credit-registration-admin-manual-link-linked",
  student_number_not_found: "credit-registration-admin-manual-link-not-found",
  preview_mismatch: "credit-registration-admin-manual-link-preview-mismatch",
  already_linked_to_another_account: "credit-registration-admin-manual-link-other-account",
  already_linked_to_this_account: "credit-registration-admin-manual-link-this-account",
  study_registry_unavailable: "credit-registration-admin-manual-link-registry-unavailable",
} as const satisfies Record<AdminManualLinkOutcome, string>

const MANUAL_LINK_OUTCOME_UNKNOWN_KEY = "credit-registration-admin-manual-link-unknown-outcome"

/** An unrecognised outcome must not fall back to `linked`: that reads as the link having been made. */
export const manualLinkOutcomeLabel = (t: TFunction, outcome: AdminManualLinkOutcome): string =>
  labelFrom(t, MANUAL_LINK_OUTCOME_KEYS, outcome, MANUAL_LINK_OUTCOME_UNKNOWN_KEY)
