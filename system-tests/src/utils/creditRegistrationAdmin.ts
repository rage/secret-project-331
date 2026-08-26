/**
 * Reader for the admin credit-registration API (`/api/v0/main-frontend/credit-registration-admin`).
 *
 * Every typed function here fails on anything but a 2xx, so a spec proving a refusal uses one of the
 * exported URLs itself. The interfaces carry only the subset of each DTO these specs read.
 */

import type { APIRequestContext, APIResponse } from "@playwright/test"

import { getJson, MAIN_FRONTEND_API, queryString } from "./creditRegistration"
import type { CreditRegistrationPhase } from "./suotarControl"

export const CREDIT_REGISTRATION_ADMIN_API = `${MAIN_FRONTEND_API}/credit-registration-admin`
export const ADMIN_REGISTRATIONS_URL = `${CREDIT_REGISTRATION_ADMIN_API}/registrations`

export const adminRegistrationUrl = (registrationId: string): string =>
  `${ADMIN_REGISTRATIONS_URL}/${registrationId}`

export const adminRegistrationTransitionUrl = (registrationId: string): string =>
  `${adminRegistrationUrl(registrationId)}/transition`

export const ADMIN_MANUAL_LINK_URL = `${CREDIT_REGISTRATION_ADMIN_API}/account-linking/manual-link`

export interface AdminPhaseStatus {
  phase: string
  process_name: string
  last_heartbeat_at: string | null
  paused_at: string | null
  pause_reason: string | null
  implemented: boolean
}

export interface AdminOverview {
  phases: AdminPhaseStatus[]
}

export interface AdminRegistrationRow {
  id: string
  email: string | null
  state: string
  /** What a `pending` row waits on, derived per request; null in every other state. */
  pending_reason: "completion" | "consent" | "student_number" | null
  error_code: string | null
  submit_retry_count: number
  /** Frozen on the row before it was sent, so not always the number the account is linked to now. */
  student_number: string | null
  selected_enrolment_id: string | null
}

export interface AdminRegistrationsPage {
  data: AdminRegistrationRow[]
  total_count: number
}

export interface AdminRegistrationAction {
  action: string
  actor_role: string
  reason: string | null
  before_state: string | null
  after_state: string | null
}

/** One of the two student terminal-state mails, as the admin detail view reports it. */
export interface AdminNotificationEmail {
  kind: "action_needed" | "registered"
  /** Stable for the life of the row: a change here means a second mail of this kind went out. */
  email_delivery_id: string
  send_status: { email_send_status: string; sent_at: string | null }
}

/** One attempt as the admin detail view reports it. */
export interface AdminRegistrationAttempt {
  id: string
  state: string
  attempt_number: number
  superseded: boolean
  terminal_at: string | null
  needs_admin_attention: boolean
  /** Frozen before the attempt was sent, so it is the grade this attempt actually carried. */
  grade_id: string | null
  grade_scale_id: string | null
}

export interface AdminRegistrationDetails {
  registration: AdminRegistrationAttempt
  /** Every attempt for the same completion, this one included. */
  attempts: AdminRegistrationAttempt[]
  events: { details: unknown }[]
  suotar_api_calls: { request_body_sample: unknown; response_body_sample: unknown }[]
  actions: AdminRegistrationAction[]
  notification_emails: AdminNotificationEmail[]
  /** Only on a row the study registry declined as no improvement. */
  not_improved_attainment: { grade_id: string | null; grade_scale_id: string | null } | null
}

export interface AccountLinkingRealisationCounters {
  course_id: string
  last_listed_at: string | null
  listed_person_count: number | null
}

export interface AccountLinkingStats {
  realisations: AccountLinkingRealisationCounters[]
}

export interface AdminRegistrationFilter {
  student_number?: string
  course_id?: string
  state?: string
  needs_admin_attention?: boolean
  limit?: number
}

export const adminOverview = (request: APIRequestContext): Promise<AdminOverview> =>
  getJson<AdminOverview>(request, `${CREDIT_REGISTRATION_ADMIN_API}/overview`)

export const listAdminRegistrations = (
  request: APIRequestContext,
  filter: AdminRegistrationFilter = {},
): Promise<AdminRegistrationsPage> =>
  // Spread: an interface has no index signature, so it does not satisfy `queryString`'s parameter.
  getJson<AdminRegistrationsPage>(
    request,
    `${ADMIN_REGISTRATIONS_URL}${queryString({ ...filter })}`,
  )

export const adminRegistrationDetails = (
  request: APIRequestContext,
  registrationId: string,
): Promise<AdminRegistrationDetails> =>
  getJson<AdminRegistrationDetails>(request, adminRegistrationUrl(registrationId))

export const accountLinkingStats = (request: APIRequestContext): Promise<AccountLinkingStats> =>
  getJson<AccountLinkingStats>(request, `${CREDIT_REGISTRATION_ADMIN_API}/account-linking`)

export interface AdminAuditRow {
  action: string
  target_kind: string
  target_id: string | null
  target_phase: string | null
  actor_role: string
  reason: string | null
}

export interface AdminAuditPage {
  data: AdminAuditRow[]
  total_count: number
}

export interface AdminAuditFilter {
  action?: string
  actor_role?: string
  target_kind?: string
  target_id?: string
  target_phase?: string
  course_id?: string
  limit?: number
}

/** The global action log, covering both actor kinds and every target kind. */
export const adminAuditLog = (
  request: APIRequestContext,
  filter: AdminAuditFilter = {},
): Promise<AdminAuditPage> =>
  // Spread: an interface has no index signature, so it does not satisfy `queryString`'s parameter.
  getJson<AdminAuditPage>(
    request,
    `${CREDIT_REGISTRATION_ADMIN_API}/audit${queryString({ ...filter })}`,
  )

export interface AdminErrorCodeWindow {
  error_code: string
  retryability: string
  current_count: number
  previous_count: number
}

export interface AdminErrorsByCode {
  window_secs: number
  codes: AdminErrorCodeWindow[]
  verdicts: { registered_count: number; failed_permanent_count: number; total_count: number }
}

/** Error events grouped by code over one window, and the same window before it. */
export const errorsByCode = (
  request: APIRequestContext,
  windowSecs?: number,
): Promise<AdminErrorsByCode> =>
  getJson<AdminErrorsByCode>(
    request,
    `${CREDIT_REGISTRATION_ADMIN_API}/errors/by-code${queryString({ window_secs: windowSecs })}`,
  )

export interface AdminAttentionItem {
  credit_registration_id: string
  state: string
  error_code: string | null
  attempt_count: number
  reasons: string[]
}

export interface AdminAttentionItems {
  items: AdminAttentionItem[]
  total_count: number
  counts_by_reason: { reason: string; count: number }[]
}

/** The rows the detectors say need a human, each carrying every detector that picked it. */
export const attentionItems = (request: APIRequestContext): Promise<AdminAttentionItems> =>
  getJson<AdminAttentionItems>(request, `${CREDIT_REGISTRATION_ADMIN_API}/attention`)

export interface AdminPhaseRow {
  phase: string
  process_name: string
  implemented: boolean
  paused_at: string | null
  heartbeat_late: boolean
  failing: boolean
  owned_states: string[]
  queue_depth: number | null
}

export interface AdminPhaseList {
  phases: AdminPhaseRow[]
  paused_globally: boolean
}

/** One row per pipeline phase, pre-sorted by process then pipeline order. */
export const listAdminPhases = (request: APIRequestContext): Promise<AdminPhaseList> =>
  getJson<AdminPhaseList>(request, `${CREDIT_REGISTRATION_ADMIN_API}/phases`)

export interface AdminCourseModuleStats {
  course_id: string
  course_module_id: string
  course_name: string
  paused_at: string | null
  eligible_completion_count: number
  registration_count: number
  config_checked_at: string | null
  check: { course_code_resolves: boolean | null; product_token_found: boolean | null }
}

export interface AdminCourseStats {
  modules: AdminCourseModuleStats[]
  misconfigured_count: number
}

/** One row per course module with credit registration enabled, with its configuration verdict. */
export const creditRegistrationCourseStats = (
  request: APIRequestContext,
): Promise<AdminCourseStats> =>
  getJson<AdminCourseStats>(request, `${CREDIT_REGISTRATION_ADMIN_API}/courses`)

export interface AdminReconciliation {
  finding_count: number
  never_entered_count: number
  outcome_uncertain_count: number
  several_submitted_attainments_count: number
  misregistered_count: number
  legacy_divergence_count: number
  outcome_unknown_consent_withdrawn_count: number
  outcome_unknown_consent_withdrawn: { credit_registration_id: string; state: string }[]
}

/** The drift detectors. The consent-withdrawal bucket is deliberately outside `finding_count`. */
export const creditRegistrationReconciliation = (
  request: APIRequestContext,
): Promise<AdminReconciliation> =>
  getJson<AdminReconciliation>(request, `${CREDIT_REGISTRATION_ADMIN_API}/reconciliation`)

export interface SuotarApiCallRow {
  id: string
  endpoint: string
  succeeded: boolean
  request_item_count: number
  credit_registration_ids: string[]
}

export interface SuotarApiCallsPage {
  data: SuotarApiCallRow[]
  total_count: number
  worker_names: string[]
}

export interface SuotarApiCallDetails {
  request_body_sample: unknown
  response_body_sample: unknown
  ledger_references: {
    credit_registration_id: string
    request_item_id: string
    student_number: string | null
    first_name: string | null
    last_name: string | null
  }[]
  events: { credit_registration_id: string }[]
}

/** The call log. `credit_registration_id` is the search key that replaces free-text on the bodies. */
export const listSuotarApiCalls = (
  request: APIRequestContext,
  filter: { credit_registration_id?: string; succeeded?: boolean; limit?: number } = {},
): Promise<SuotarApiCallsPage> =>
  getJson<SuotarApiCallsPage>(
    request,
    `${CREDIT_REGISTRATION_ADMIN_API}/suotar-api-calls${queryString({ ...filter })}`,
  )

export const suotarApiCall = (
  request: APIRequestContext,
  suotarApiCallId: string,
): Promise<SuotarApiCallDetails> =>
  getJson<SuotarApiCallDetails>(
    request,
    `${CREDIT_REGISTRATION_ADMIN_API}/suotar-api-calls/${suotarApiCallId}`,
  )

export const ADMIN_RESOLVE_PERSON_URL = `${CREDIT_REGISTRATION_ADMIN_API}/account-linking/resolve-person`

/** The subset of `adminResolveStudentNumberForLinking` the linking specs read. */
export interface AdminResolvedStudentNumber {
  found: boolean
  already_linked_to_user_id: string | null
  already_linked_via: string | null
  linking_emails: { id: string; emailed_to: string }[]
}

/**
 * Who the registry says a number belongs to, and every linking mail we have claimed for them. The
 * only read that answers "was this person mailed a link", which is what the fast-track specs assert
 * the absence of.
 */
export const adminResolveStudentNumber = async (
  request: APIRequestContext,
  studentNumber: string,
): Promise<AdminResolvedStudentNumber> => {
  const response = await request.post(ADMIN_RESOLVE_PERSON_URL, {
    data: { student_number: studentNumber },
  })
  if (!response.ok()) {
    throw new Error(
      `Resolving ${studentNumber} answered ${response.status()}: ${await response.text()}`,
    )
  }
  return (await response.json()) as AdminResolvedStudentNumber
}

export type PhaseAction = "pause" | "resume" | "run-now"

/** Raw: for the specs proving an unknown phase name or a missing reason is refused. */
export const postAdminPhaseAction = (
  request: APIRequestContext,
  phase: string,
  action: PhaseAction,
  reason: string | null,
): Promise<APIResponse> =>
  request.post(`${CREDIT_REGISTRATION_ADMIN_API}/phases/${phase}/${action}`, { data: { reason } })

const phaseAction = async (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
  action: PhaseAction,
  reason: string | null,
): Promise<AdminPhaseStatus> => {
  const response = await postAdminPhaseAction(request, phase, action, reason)
  if (!response.ok()) {
    throw new Error(
      `${action} on the ${phase} phase answered ${response.status()}: ${await response.text()}`,
    )
  }
  return (await response.json()) as AdminPhaseStatus
}

export const pausePhase = (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
  reason: string,
): Promise<AdminPhaseStatus> => phaseAction(request, phase, "pause", reason)

export const resumePhase = (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
): Promise<AdminPhaseStatus> => phaseAction(request, phase, "resume", null)

export const runPhaseNow = (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
): Promise<AdminPhaseStatus> => phaseAction(request, phase, "run-now", null)

/**
 * Un-parks one ledger row so the next tick claims it: the first verify poll is scheduled two minutes
 * after a submission and an uncertain one fifteen, neither of which fits in a test.
 */
export const makeRegistrationDueNow = async (
  request: APIRequestContext,
  registrationId: string,
): Promise<void> => {
  const url = adminRegistrationTransitionUrl(registrationId)
  const response = await request.post(url, {
    data: { to_state: "check_now", reason: "System test: check without waiting out the backoff." },
  })
  if (!response.ok()) {
    throw new Error(`POST ${url} answered ${response.status()}: ${await response.text()}`)
  }
}

export interface ManualLinkPayload {
  user_id: string
  student_number: string
  sisu_person_id: string
  reason: string
}

/** Raw: every spec that links by hand is either proving a refusal or reading the outcome. */
export const postAdminManualLink = (
  request: APIRequestContext,
  payload: ManualLinkPayload,
): Promise<APIResponse> => request.post(ADMIN_MANUAL_LINK_URL, { data: payload })
