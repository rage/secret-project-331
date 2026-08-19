/**
 * Client for the mock Suotar control surface (`/api/v0/mock-suotar/control/*`).
 *
 * Hand-written because the mock's DTOs are deliberately not exported to `bindings.ts`, the
 * same way `mock_sisu`'s are not.
 *
 * The tick endpoints exist because the real loops are long-running intervals in their own
 * Deployments, which a spec cannot wait out inside the 100 s per-test timeout. A tick runs one
 * iteration of one phase synchronously.
 *
 * - **A tick sweeps everything it is not scoped away from.** Pass a scope, or the iteration advances
 *   every eligible row in the database. Aggregates stay global either way, so assert on your own
 *   student and course.
 * - `runTick` refuses anything but a clean run: a paused phase, an open circuit breaker, a refused
 *   scope and an unimplemented phase all move no rows, and would otherwise surface as a poll timing
 *   out against the innocent state machine.
 */

import type { APIRequestContext } from "@playwright/test"

export const CONTROL_BASE_URL = "http://project-331.local/api/v0/mock-suotar/control"

/** Must match `CreditRegistrationPhase` in the backend. */
export const CREDIT_REGISTRATION_PHASES = [
  "materialize",
  "preconditions",
  "resolve-enrolments",
  "import",
  "verify",
  "legacy-mirror",
  "student-notifications",
  "enrolment-discovery",
  "link-emails",
  "product-token-refresh",
  "config-validation",
  "retention-sweep",
  "ledger-snapshot",
] as const

export type CreditRegistrationPhase = (typeof CREDIT_REGISTRATION_PHASES)[number]

/**
 * Which rows a tick may touch. A scenario hands back the same object, which also serves as a fault's
 * `owner`.
 */
export interface TickScope {
  courseId?: string
  courseSlug?: string
  userId?: string
  userEmail?: string
  creditRegistrationIds?: string[]
}

/** One iteration that happened. `error` is the phase's own failure, not a row landing on an error code. */
export interface RanPhaseTick {
  status: "ran"
  phase: CreditRegistrationPhase
  itemsProcessed: number
  itemsFailed: number
  error: string | null
}

export type PhaseTickResult =
  | RanPhaseTick
  /** The phase is paused, or its circuit breaker is open. Nothing ran this tick. */
  | { status: "skipped"; phase: CreditRegistrationPhase; reason: "paused" | "circuitBreakerOpen" }
  /** The scope named something this phase's claim query cannot narrow on. */
  | { status: "scopeNotSupported"; phase: CreditRegistrationPhase }
  | { status: "unknownPhase"; phase: string | null; knownPhases: string[] }
  | { status: "unresolvedScope"; half: string; value: string }

const scopeQuery = (scope?: TickScope): string => {
  if (!scope) {
    return ""
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(scope)) {
    if (value === undefined) {
      continue
    }
    params.append(key, Array.isArray(value) ? value.join(",") : value)
  }
  const query = params.toString()
  return query === "" ? "" : `&${query}`
}

/**
 * Hands back whatever the endpoint answered, refusals included, for the specs asserting that a paused
 * phase skips or that a phase fails. Everything else wants `runTick`.
 */
export const runTickUnchecked = async (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
  scope?: TickScope,
): Promise<PhaseTickResult> => {
  const response = await request.post(
    `${CONTROL_BASE_URL}/run-tick?phase=${phase}${scopeQuery(scope)}`,
  )
  // 501 is the "no implementation registered yet" answer and 400 covers the unknown phase and the two
  // scope refusals; anything else (notably 404) means the mock is not enabled and the spec is invalid.
  if (![200, 400, 501].includes(response.status())) {
    throw new Error(
      `Unexpected status ${response.status()} from run-tick?phase=${phase}. Is USE_MOCK_SUOTAR_ENDPOINT on? Body: ${await response.text()}`,
    )
  }
  return (await response.json()) as PhaseTickResult
}

/**
 * Ticks one phase and fails unless the iteration ran and the phase reported no error of its own.
 * `itemsFailed` is deliberately not part of that: a row landing on an error code is the outcome half
 * these specs exist to assert.
 */
export const runTick = async (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
  scope?: TickScope,
): Promise<RanPhaseTick> => {
  const result = await runTickUnchecked(request, phase, scope)
  if (result.status !== "ran" || result.error !== null) {
    const scoped = scope ? ` scoped to ${JSON.stringify(scope)}` : " unscoped"
    throw new Error(`Ticking ${phase}${scoped} did not run cleanly: ${JSON.stringify(result)}`)
  }
  return result
}

export const runMaterializeTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "materialize", scope)

export const runPreconditionsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "preconditions", scope)

export const runResolveEnrolmentsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "resolve-enrolments", scope)

export const runImportSubmissionTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "import", scope)

export const runVerifyPollTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "verify", scope)

/**
 * Separate from the registrar tick sequence because the whole point of these specs is that one
 * explicit iteration queues each mail once and a second queues nothing.
 */
export const runStudentNotificationsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "student-notifications", scope)

export const runEnrolmentDiscoveryTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "enrolment-discovery", scope)

/**
 * Separate from enrolment discovery because the fast-track specs assert that **no** linking
 * mail was queued, which needs the mailing phase run on its own.
 */
export const runLinkEmailsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "link-emails", scope)

export const runProductTokenRefreshTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "product-token-refresh", scope)

export const runConfigValidationTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<RanPhaseTick> => runTick(request, "config-validation", scope)

export const runRetentionSweepTick = (request: APIRequestContext): Promise<RanPhaseTick> =>
  runTick(request, "retention-sweep")

export const runLedgerSnapshotTick = (request: APIRequestContext): Promise<RanPhaseTick> =>
  runTick(request, "ledger-snapshot")

/** One mail sitting in our send queue for an account. */
export interface QueuedEmail {
  templateType: string
  placeholders: Record<string, string>
}

/**
 * The mails queued to one account, newest first. No mail capture exists in this repo, so a spec
 * asserting a message was composed reads the send queue rather than an inbox.
 */
export const queuedEmailsFor = async (
  request: APIRequestContext,
  userEmail: string,
): Promise<QueuedEmail[]> => {
  const response = await request.get(
    `${CONTROL_BASE_URL}/queued-emails?userEmail=${encodeURIComponent(userEmail)}`,
  )
  if (!response.ok()) {
    throw new Error(
      `Reading the queued emails of ${userEmail} answered ${response.status()}: ${await response.text()}`,
    )
  }
  return (await response.json()) as QueuedEmail[]
}

/**
 * Rewrites the grade of the completion behind one ledger row.
 *
 * A test hook rather than a product path: a teacher regrade writes a *new* completion row, and the
 * grade-improvement statement is about a completion edited in place. `grade: null` puts it on the
 * pass/fail scale, which is how a spec makes two grades incomparable.
 */
export const regradeCompletion = async (
  request: APIRequestContext,
  params: { creditRegistrationId: string; grade: number | null; passed?: boolean },
): Promise<void> => {
  const response = await request.post(`${CONTROL_BASE_URL}/regrade-completion`, { data: params })
  if (!response.ok()) {
    throw new Error(
      `Regrading the completion of ${params.creditRegistrationId} answered ${response.status()}: ${await response.text()}`,
    )
  }
}

/**
 * Drives a consented completion as far as a submission, one phase per tick. Each phase claims what
 * the one before it left, so ticking them out of order waits for a state that cannot arrive.
 */
export const runPhasesUpToSubmission = async (
  request: APIRequestContext,
  scope: TickScope,
): Promise<void> => {
  for (const phase of ["materialize", "preconditions", "resolve-enrolments", "import"] as const) {
    await runTick(request, phase, scope)
  }
}
