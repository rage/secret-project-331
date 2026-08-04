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
 * - **A tick sweeps everything it is not scoped away from.** Pass a scope so the iteration advances
 *   only your own rows and a batch carries one owner; without one it processes every eligible row in
 *   the database. Aggregates stay global either way, so assert on your own student and course.
 * - `runRegistrarTick` deliberately takes no scope: a suite that only ever ticks scoped never
 *   exercises the sweep-everything behaviour production has.
 * - A phase answers `phaseNotImplemented` until its implementation is registered. That is not a
 *   failure.
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
] as const

export type CreditRegistrationPhase = (typeof CREDIT_REGISTRATION_PHASES)[number]

/**
 * Which rows a tick may touch. A scenario hands back the same object, so a spec passes it on to
 * `runTick` and to a fault's `owner` without restating an identifier.
 */
export interface TickScope {
  courseId?: string
  courseSlug?: string
  userId?: string
  userEmail?: string
  creditRegistrationIds?: string[]
}

export type PhaseTickResult =
  | {
      status: "ran"
      phase: CreditRegistrationPhase
      itemsProcessed: number
      itemsFailed: number
      error: string | null
    }
  | { status: "phaseNotImplemented"; phase: CreditRegistrationPhase }
  /** The phase is paused, or its circuit breaker is open. Not a failure — nothing ran this tick. */
  | { status: "skipped"; phase: CreditRegistrationPhase; reason: "paused" | "circuitBreakerOpen" }
  /** The scope named something this phase's claim query cannot narrow on. */
  | { status: "scopeNotSupported"; phase: CreditRegistrationPhase }
  | { status: "unknownPhase"; phase: string | null; knownPhases: string[] }
  | { status: "unresolvedScope"; half: string; value: string }

export interface RegistrarTickResult {
  phases: PhaseTickResult[]
}

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

export const runTick = async (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
  scope?: TickScope,
): Promise<PhaseTickResult> => {
  const response = await request.post(
    `${CONTROL_BASE_URL}/run-tick?phase=${phase}${scopeQuery(scope)}`,
  )
  // 501 is the "no implementation registered yet" answer and 400 the unknown-phase one; anything
  // else (notably 404) means the mock is not enabled and the whole spec is invalid.
  if (![200, 400, 501].includes(response.status())) {
    throw new Error(
      `Unexpected status ${response.status()} from run-tick?phase=${phase}. Is USE_MOCK_SUOTAR_ENDPOINT on? Body: ${await response.text()}`,
    )
  }
  return (await response.json()) as PhaseTickResult
}

/**
 * Runs materialize, preconditions, resolve-enrolments, import and verify in pipeline order.
 *
 * Use the single-phase ticks whenever the spec depends on a phase *not* running — verify polling
 * twice without re-importing, for instance.
 */
export const runRegistrarTick = async (
  request: APIRequestContext,
): Promise<RegistrarTickResult> => {
  const response = await request.post(`${CONTROL_BASE_URL}/run-registrar-tick`)
  if (!response.ok()) {
    throw new Error(
      `Unexpected status ${response.status()} from run-registrar-tick. Is USE_MOCK_SUOTAR_ENDPOINT on? Body: ${await response.text()}`,
    )
  }
  return (await response.json()) as RegistrarTickResult
}

export const runMaterializeTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "materialize", scope)

export const runPreconditionsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "preconditions", scope)

export const runResolveEnrolmentsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "resolve-enrolments", scope)

export const runImportSubmissionTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "import", scope)

export const runVerifyPollTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "verify", scope)

/** Outage recovery is the verify phase doing its job; aliased because the test plan names it. */
export const runOutageRecoveryTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "verify", scope)

export const runLegacyMirrorTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "legacy-mirror", scope)

export const runStudentNotificationsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "student-notifications", scope)

export const runEnrolmentDiscoveryTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "enrolment-discovery", scope)

/**
 * Separate from enrolment discovery because the fast-track specs assert that **no** linking
 * mail was queued, which needs the mailing phase run on its own.
 */
export const runLinkEmailsTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "link-emails", scope)

export const runProductTokenRefreshTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "product-token-refresh", scope)

export const runConfigValidationTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "config-validation", scope)

export const runRetentionSweepTick = (
  request: APIRequestContext,
  scope?: TickScope,
): Promise<PhaseTickResult> => runTick(request, "retention-sweep", scope)
