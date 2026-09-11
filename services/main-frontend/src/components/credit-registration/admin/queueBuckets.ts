import type { CreditRegistrationState } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

import type { CreditRegistrationTFunction } from "../constants"

/** What a row in this state is waiting for, which is what an operator groups the ledger by. */
export type QueueBucket = "waiting" | "in_progress" | "failed_or_blocked" | "done"

/**
 * Which bucket each ledger state belongs to. `satisfies` over the whole enum means a state added to
 * the backend fails the build here rather than silently vanishing from the totals.
 *
 * `blocked` belongs with the failures rather than with the waits: such a row waits on an admin
 * fixing the course configuration, not on the student or on Sisu.
 *
 * These are pipeline stages, not the "needs a human" attention queue built elsewhere: that queue
 * mixes rows from several stages and excludes failures nothing can be done about.
 */
export const BUCKET_OF_STATE = {
  pending: "waiting",
  ready_to_submit: "in_progress",
  resolving_enrolment: "in_progress",
  checking_enrolment: "in_progress",
  submitting: "in_progress",
  awaiting_verification: "in_progress",
  blocked: "failed_or_blocked",
  no_usable_enrolment: "failed_or_blocked",
  submission_uncertain: "failed_or_blocked",
  failed_retryable: "failed_or_blocked",
  failed_permanent: "failed_or_blocked",
  misregistered: "failed_or_blocked",
  registered: "done",
  duplicate: "done",
  not_improved: "done",
  cancelled: "done",
} as const satisfies Record<CreditRegistrationState, QueueBucket>

export const ALL_STATES = Object.keys(BUCKET_OF_STATE) as CreditRegistrationState[]

/** Pipeline order, so a list grouped by bucket reads from newest arrival to finished. */
export const BUCKET_ORDER: QueueBucket[] = ["waiting", "in_progress", "failed_or_blocked", "done"]

/** Terminal states only ever grow, so charting or measuring them beside the queues flattens both. */
export const LIVE_BUCKETS: QueueBucket[] = ["waiting", "in_progress", "failed_or_blocked"]

const BUCKET_KEYS = {
  waiting: "credit-registration-admin-bucket-waiting",
  in_progress: "credit-registration-admin-bucket-in-progress",
  failed_or_blocked: "credit-registration-admin-bucket-failed-or-blocked",
  done: "credit-registration-admin-bucket-done",
} as const satisfies Record<QueueBucket, string>

export const bucketLabel = (t: CreditRegistrationTFunction, bucket: QueueBucket): string =>
  t(BUCKET_KEYS[bucket])

/**
 * The badge tones the rest of the surface speaks, read off the theme rather than left to ECharts,
 * which colours a healthy state red and a broken one green. Hex and not a CSS variable: ECharts
 * cannot resolve one.
 */
export const BUCKET_COLORS = {
  waiting: baseTheme.colors.gray[400],
  in_progress: baseTheme.colors.blue[600],
  failed_or_blocked: baseTheme.colors.crimson[600],
  done: baseTheme.colors.green[700],
} as const satisfies Record<QueueBucket, string>
