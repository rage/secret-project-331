import type { TFunction } from "i18next"

import type {
  AdminManualLinkOutcome,
  AdminResendOutcome,
  CreditRegistrationAlertId,
  CreditRegistrationState,
  EmailSendStatus,
} from "@/generated/api/types.generated"
import type { RegistrationStatusState } from "@/shared-module/components"

import { labelFrom, widenedLookup } from "../labelFrom"

export { studentNumberVerificationLabel as verificationMethodLabel } from "../teacherCreditRegistrations"

/**
 * Which tone each ledger state reads as at a glance. Presentation only: the pill's text is the state
 * name itself, because that is the identifier an operator pastes into a message to the university,
 * and translating it would make it useless for that.
 *
 * `abandoned_by_consent_withdrawal` is deliberately `upcoming` rather than `failed`: it is neither a
 * failure nor a success, and colouring it red would put it in the wrong mental bucket forever.
 */
const STATE_TONES = {
  pending_prerequisites: "upcoming",
  pending_consent: "action-needed",
  pending_student_number: "action-needed",
  ready_to_submit: "current",
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

/** The states that mean the credit exists in the study registry, whoever put it there. */
export const isSuccessState = (state: CreditRegistrationState): boolean =>
  state === "registered" || state === "duplicate" || state === "not_improved"

const ALERT_KEYS = {
  credentials_rejected: "credit-registration-alert-credentials-rejected",
  study_registry_unreachable: "credit-registration-alert-study-registry-unreachable",
  stuck_registrations: "credit-registration-alert-stuck-registrations",
  linking_mail_send_failed: "credit-registration-alert-linking-mail-send-failed",
  phase_heartbeat_stale: "credit-registration-alert-phase-heartbeat-stale",
} as const satisfies Record<CreditRegistrationAlertId, string>

const GENERIC_ALERT_KEY = "credit-registration-alert-generic"

/**
 * The sentence one alert reads as. The backend sends identifiers and numbers only, so the wording and
 * the choice of which numbers to name live here.
 */
export const alertSentence = (
  t: TFunction,
  id: CreditRegistrationAlertId,
  count: number,
  subject: string | null | undefined,
): string => labelFrom(t, ALERT_KEYS, id, GENERIC_ALERT_KEY, { count, subject: subject ?? "" })

const SEND_STATUS_KEYS = {
  queued: "credit-registration-admin-send-status-queued",
  retrying: "credit-registration-admin-send-status-retrying",
  sent: "credit-registration-admin-send-status-sent",
  send_failed: "credit-registration-admin-send-status-send-failed",
} as const satisfies Record<EmailSendStatus, string>

const SEND_STATUS_UNKNOWN_KEY = "credit-registration-admin-send-status-unknown"

/**
 * Our send status and nothing more. We hand mail to a relay; what happens after is invisible to us, so
 * no wording here may imply a delivery. An unrecognised status falls back to saying so, not to
 * `queued`: that would read as a status we have, not as the gap it is.
 */
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
