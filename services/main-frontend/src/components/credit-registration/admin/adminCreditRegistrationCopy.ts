import type { TFunction } from "i18next"

import type {
  AdminBulkTransitionSkip,
  AdminManualLinkOutcome,
  AdminResendOutcome,
  CreditRegistrationAdminAction,
  CreditRegistrationAdminActionTarget,
  CreditRegistrationAlertId,
  CreditRegistrationAttentionReason,
  CreditRegistrationState,
  EmailSendStatus,
  Retryability,
} from "@/generated/api/types.generated"
import type { RegistrationStatusState } from "@/shared-module/components"

import { labelFrom, widenedLookup } from "../labelFrom"

export {
  notificationEmailLabel as notificationKindLabel,
  studentNumberVerificationLabel as verificationMethodLabel,
} from "../teacherCreditRegistrations"

/** `abandoned_by_consent_withdrawal` is `upcoming`, not `failed`: neither failure nor success. */
const STATE_TONES = {
  pending_prerequisites: "upcoming",
  pending_consent: "action-needed",
  pending_student_number: "action-needed",
  ready_to_submit: "current",
  resolving_enrolment: "current",
  checking_enrolment: "current",
  no_usable_enrolment: "action-needed",
  submitting: "current",
  submission_uncertain: "failed",
  awaiting_verification: "current",
  registered: "done",
  duplicate: "done",
  not_improved: "done",
  misregistered: "failed",
  failed_retryable: "action-needed",
  failed_permanent: "failed",
  blocked: "upcoming",
  cancelled: "upcoming",
  abandoned_by_consent_withdrawal: "upcoming",
} as const satisfies Record<CreditRegistrationState, RegistrationStatusState>

export const stateTone = (state: CreditRegistrationState): RegistrationStatusState =>
  widenedLookup(STATE_TONES, state) ?? "upcoming"

/** The credit exists in the study registry, whoever put it there. */
export const isSuccessState = (state: CreditRegistrationState): boolean =>
  state === "registered" || state === "duplicate" || state === "not_improved"

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

export const alertSentence = (
  t: TFunction,
  id: CreditRegistrationAlertId,
  count: number,
  subject: string | null | undefined,
  total: number | null | undefined,
): string =>
  labelFrom(t, ALERT_KEYS, id, GENERIC_ALERT_KEY, {
    count,
    subject: subject ?? "",
    total: total ?? 0,
  })

const ATTENTION_REASON_KEYS = {
  stuck_in_state: "credit-registration-admin-reason-stuck-in-state",
  permanent_error: "credit-registration-admin-reason-permanent-error",
  retry_window_expired: "credit-registration-admin-reason-retry-window-expired",
  misregistered: "credit-registration-admin-reason-misregistered",
  too_many_attempts: "credit-registration-admin-reason-too-many-attempts",
  outcome_uncertain: "credit-registration-admin-reason-outcome-uncertain",
  flagged_by_pipeline: "credit-registration-admin-reason-flagged-by-pipeline",
} as const satisfies Record<CreditRegistrationAttentionReason, string>

const ATTENTION_REASON_UNKNOWN_KEY = "credit-registration-admin-reason-unknown"

/** Which detector put a row on the attention table. */
export const attentionReasonLabel = (
  t: TFunction,
  reason: CreditRegistrationAttentionReason,
): string => labelFrom(t, ATTENTION_REASON_KEYS, reason, ATTENTION_REASON_UNKNOWN_KEY)

const BULK_SKIP_KEYS = {
  superseded: "credit-registration-admin-skip-superseded",
  submission_uncertain: "credit-registration-admin-skip-submission-uncertain",
  without_consent: "credit-registration-admin-skip-without-consent",
} as const satisfies Record<AdminBulkTransitionSkip, string>

const BULK_SKIP_UNKNOWN_KEY = "credit-registration-admin-skip-unknown"

/** Why a selected row was left alone. Never silence these: a skipped row is not a moved row. */
export const bulkSkipLabel = (t: TFunction, reason: AdminBulkTransitionSkip): string =>
  labelFrom(t, BULK_SKIP_KEYS, reason, BULK_SKIP_UNKNOWN_KEY)

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

const ADMIN_ACTION_KEYS = {
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

const ADMIN_TARGET_KEYS = {
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

const RESEND_OUTCOME_KEYS = {
  queued: "credit-registration-admin-resend-queued",
  already_mailed_to_every_known_address: "credit-registration-admin-resend-already-mailed",
  refused_by_rate_cap: "credit-registration-admin-resend-refused-by-rate-cap",
  no_address_in_study_registry: "credit-registration-admin-resend-no-address",
  not_on_the_course_roster: "credit-registration-admin-resend-not-on-roster",
  already_linked: "credit-registration-admin-resend-already-linked",
  study_registry_unavailable: "credit-registration-admin-resend-registry-unavailable",
} as const satisfies Record<AdminResendOutcome, string>

const RESEND_OUTCOME_UNKNOWN_KEY = "credit-registration-admin-resend-unknown-outcome"

/** An unrecognised outcome must not fall back to `queued`: that reads as the resend having worked. */
export const resendOutcomeLabel = (t: TFunction, outcome: AdminResendOutcome): string =>
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
