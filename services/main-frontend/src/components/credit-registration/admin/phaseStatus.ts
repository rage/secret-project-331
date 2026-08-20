import type { CreditRegistrationPhaseRow } from "@/generated/api/types.generated"

export type PhaseHealth =
  | "paused"
  | "not_built"
  | "failing"
  | "heartbeat_late"
  | "never_reported"
  | "running"

/** What the Workers tab's status column says. `paused` wins: a paused phase is not late, it is stopped. */
export const phaseHealth = (phase: CreditRegistrationPhaseRow): PhaseHealth => {
  if (phase.paused_at) {
    return "paused"
  }
  if (!phase.implemented) {
    return "not_built"
  }
  if (phase.failing) {
    return "failing"
  }
  if (phase.heartbeat_late) {
    return "heartbeat_late"
  }
  if (!phase.last_heartbeat_at) {
    return "never_reported"
  }
  return "running"
}

const NEEDS_ATTENTION: ReadonlySet<PhaseHealth> = new Set(["paused", "failing", "heartbeat_late"])

/**
 * Whether the phase is one the tab badge counts. A phase that has never reported is deliberately
 * out: on a database whose workers have not started yet that would be a badge nobody can clear.
 */
export const phaseNeedsAttention = (phase: CreditRegistrationPhaseRow): boolean =>
  NEEDS_ATTENTION.has(phaseHealth(phase))
