import type {
  BreakerTarget,
  CreditRegistrationCircuitBreakerState,
} from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"

export type BreakerHealth = "closed" | "open" | "waiting_to_probe"

/**
 * `waiting_to_probe`: the cooldown has passed, but the API only exposes that as the failure count
 * staying at the trip threshold; it drops back below it once a call finally succeeds.
 */
export const breakerHealth = (breaker: CreditRegistrationCircuitBreakerState): BreakerHealth => {
  if (breaker.open) {
    return "open"
  }
  return breaker.consecutive_failures >= breaker.trips_after_consecutive_failures
    ? "waiting_to_probe"
    : "closed"
}

const HEALTH_KEYS = {
  closed: "credit-registration-admin-breaker-closed",
  open: "credit-registration-admin-breaker-open",
  waiting_to_probe: "credit-registration-admin-breaker-waiting-to-probe",
} as const satisfies Record<BreakerHealth, string>

export const breakerHealthLabel = (t: CreditRegistrationTFunction, health: BreakerHealth): string =>
  t(HEALTH_KEYS[health])

/** Whether a breaker's state should stand out rather than read as ordinary. */
export const isUnhealthyBreaker = (health: BreakerHealth): boolean => health !== "closed"

const TARGET_KEYS = {
  study_registry: "credit-registration-admin-breaker-target-study-registry",
  sisu_submissions: "credit-registration-admin-breaker-target-sisu-submissions",
} as const satisfies Record<BreakerTarget, string>

/** The plain-language name for what one breaker guards, e.g. "Suotar" or "Sisu submissions". */
export const breakerTargetLabel = (t: CreditRegistrationTFunction, target: BreakerTarget): string =>
  t(TARGET_KEYS[target])

/** An ISO timestamp `open_for_secs` seconds out, for `RelativeTime` to render as e.g. "in 5 min". */
export const breakerNextAttemptAt = (openForSecs: number): string =>
  new Date(Date.now() + openForSecs * 1000).toISOString()
