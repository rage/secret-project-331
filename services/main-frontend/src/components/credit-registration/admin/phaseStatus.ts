import type { TFunction } from "i18next"

import { formatDuration } from "@/utils/moduleTimeline"

const MINUTE_SECS = 60

/**
 * A phase's tick interval in words. Not `formatDuration` alone: it rounds to whole minutes, which
 * turns the phases that tick every 30 seconds into "0 min".
 */
export const formatIntervalSecs = (seconds: number, t: TFunction): string =>
  seconds < MINUTE_SECS ? t("duration-seconds", { seconds }) : formatDuration(seconds, t)

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

/** What the System tab's status column says. `paused` wins: a paused phase is not late, it is stopped. */
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

const HEALTH_KEYS = {
  paused: "credit-registration-admin-phase-paused",
  not_built: "credit-registration-admin-phase-not-built",
  failing: "credit-registration-admin-phase-failing",
  heartbeat_late: "credit-registration-admin-phase-heartbeat-late",
  never_reported: "credit-registration-admin-phase-never-reported",
  running: "credit-registration-admin-phase-running",
} as const satisfies Record<PhaseHealth, string>

/** The System tab's status text for a phase health. */
export const phaseHealthLabel = (t: TFunction, health: PhaseHealth): string =>
  t(HEALTH_KEYS[health])

/** Whether a health should stand out in the phase list rather than read as ordinary. */
export const isUnhealthyPhase = (health: PhaseHealth): boolean =>
  health === "failing" || health === "heartbeat_late"

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
