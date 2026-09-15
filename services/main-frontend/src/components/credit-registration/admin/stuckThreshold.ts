import type { CreditRegistrationState, StuckThresholds } from "@/generated/api/types.generated"

/** The states a row can be stuck in; every other state is either terminal or waiting on a person. */
const THRESHOLD_OF_STATE = {
  ready_to_submit: "stuck_ready_to_submit_secs",
  submitting: "stuck_submitting_secs",
  awaiting_verification: "stuck_awaiting_verification_secs",
  failed_retryable: "stuck_failed_retryable_secs",
} as const satisfies Partial<Record<CreditRegistrationState, keyof StuckThresholds>>

/** How long a row may sit in `state` before it counts as stuck, or `null` where nothing counts. */
export const stuckThresholdSecs = (
  state: CreditRegistrationState,
  thresholds: StuckThresholds,
): number | null => {
  const field = (THRESHOLD_OF_STATE as Partial<Record<string, keyof StuckThresholds>>)[state]
  return field === undefined ? null : thresholds[field]
}

/** Seconds since `at`, floored at zero so a clock skewed into the future reads as "just now". */
export const secondsSince = (at: string): number =>
  Math.max(0, (Date.now() - new Date(at).getTime()) / 1000)
