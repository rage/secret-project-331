export type PhaseHealth =
  | "paused"
  | "not_built"
  | "failing"
  | "heartbeat_late"
  | "never_reported"
  | "running"

/**
 * The fields `phaseHealth` needs. `CreditRegistrationPhaseStatus` (the Overview endpoint's row)
 * satisfies this structurally too, minus `failing`, which it never reports.
 */
export interface PhaseHealthFields {
  paused_at?: string | null
  implemented: boolean
  failing?: boolean
  heartbeat_late: boolean
  last_heartbeat_at?: string | null
}

/** What the System tab's status badge says. `paused` wins: a paused phase is not late, it is stopped. */
export const phaseHealth = (phase: PhaseHealthFields): PhaseHealth => {
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

/** How many phases are in each health, so a caller never names one health as a bare string. */
export const countPhasesByHealth = (phases: PhaseHealthFields[]): Record<PhaseHealth, number> => {
  const counts: Record<PhaseHealth, number> = {
    paused: 0,
    not_built: 0,
    failing: 0,
    heartbeat_late: 0,
    never_reported: 0,
    running: 0,
  }
  for (const phase of phases) {
    counts[phaseHealth(phase)] += 1
  }
  return counts
}
