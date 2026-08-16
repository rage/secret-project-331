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
