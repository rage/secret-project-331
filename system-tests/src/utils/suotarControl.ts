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
 * - **Ticks are global.** One tick processes every eligible row in the whole database, not just the
 *   rows your spec seeded. Assert only on your own student and course, never on a global count.
 * - A phase answers `phaseNotImplemented` until its implementation is registered. That is not a
 *   failure.
 */

import type { APIRequestContext } from "@playwright/test"

const CONTROL_BASE_URL = "http://project-331.local/api/v0/mock-suotar/control"

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

export type PhaseTickResult =
  | {
      status: "ran"
      phase: CreditRegistrationPhase
      itemsProcessed: number
      itemsFailed: number
      error: string | null
    }
  | { status: "phaseNotImplemented"; phase: CreditRegistrationPhase }
  | { status: "unknownPhase"; phase: string | null; knownPhases: string[] }

export interface RegistrarTickResult {
  phases: PhaseTickResult[]
}

export const runTick = async (
  request: APIRequestContext,
  phase: CreditRegistrationPhase,
): Promise<PhaseTickResult> => {
  const response = await request.post(`${CONTROL_BASE_URL}/run-tick?phase=${phase}`)
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

export const runMaterializeTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "materialize")

export const runPreconditionsTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "preconditions")

export const runResolveEnrolmentsTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "resolve-enrolments")

export const runImportSubmissionTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "import")

export const runVerifyPollTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "verify")

/** Outage recovery is the verify phase doing its job; aliased because the test plan names it. */
export const runOutageRecoveryTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "verify")

export const runLegacyMirrorTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "legacy-mirror")

export const runStudentNotificationsTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "student-notifications")

export const runEnrolmentDiscoveryTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "enrolment-discovery")

/**
 * Separate from enrolment discovery because the fast-track specs assert that **no** linking
 * mail was queued, which needs the mailing phase run on its own.
 */
export const runLinkEmailsTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "link-emails")

export const runProductTokenRefreshTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "product-token-refresh")

export const runConfigValidationTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "config-validation")

export const runRetentionSweepTick = (request: APIRequestContext): Promise<PhaseTickResult> =>
  runTick(request, "retention-sweep")
