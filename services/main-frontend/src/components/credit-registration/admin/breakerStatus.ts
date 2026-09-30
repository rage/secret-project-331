import type { BreakerTarget, CircuitBreakerStatus } from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"

const STATUS_KEYS = {
  closed: "credit-registration-admin-breaker-closed",
  open: "credit-registration-admin-breaker-open",
  waiting_to_probe: "credit-registration-admin-breaker-waiting-to-probe",
} as const satisfies Record<CircuitBreakerStatus, string>

export const breakerStatusLabel = (
  t: CreditRegistrationTFunction,
  status: CircuitBreakerStatus,
): string => t(STATUS_KEYS[status])

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
