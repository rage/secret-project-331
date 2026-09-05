import type { TFunction } from "i18next"

import type { CreditRegistrationState } from "@/generated/api/types.generated"

/** What a row in this state is waiting for, which is what an operator groups the ledger by. */
export type QueueBucket = "waiting" | "in_progress" | "needs_human" | "done"

/**
 * Which bucket each ledger state belongs to. `satisfies` over the whole enum means a state added to
 * the backend fails the build here rather than silently vanishing from the totals.
 *
 * `blocked` is a human's problem rather than somebody else's: such a row waits on an admin fixing
 * the course configuration, which is also why the pipeline flags it for attention.
 */
export const BUCKET_OF_STATE = {
  pending: "waiting",
  ready_to_submit: "in_progress",
  resolving_enrolment: "in_progress",
  checking_enrolment: "in_progress",
  submitting: "in_progress",
  awaiting_verification: "in_progress",
  blocked: "needs_human",
  no_usable_enrolment: "needs_human",
  submission_uncertain: "needs_human",
  failed_retryable: "needs_human",
  failed_permanent: "needs_human",
  misregistered: "needs_human",
  registered: "done",
  duplicate: "done",
  not_improved: "done",
  cancelled: "done",
} as const satisfies Record<CreditRegistrationState, QueueBucket>

export const ALL_STATES = Object.keys(BUCKET_OF_STATE) as CreditRegistrationState[]

/** Pipeline order, so a list grouped by bucket reads from newest arrival to finished. */
export const BUCKET_ORDER: QueueBucket[] = ["waiting", "in_progress", "needs_human", "done"]

/** Terminal states only ever grow, so charting or measuring them beside the queues flattens both. */
export const LIVE_BUCKETS: QueueBucket[] = ["waiting", "in_progress", "needs_human"]

const BUCKET_KEYS = {
  waiting: "credit-registration-admin-bucket-waiting",
  in_progress: "credit-registration-admin-bucket-in-progress",
  needs_human: "credit-registration-admin-bucket-needs-human",
  done: "credit-registration-admin-bucket-done",
} as const satisfies Record<QueueBucket, string>

export const bucketLabel = (t: TFunction, bucket: QueueBucket): string => t(BUCKET_KEYS[bucket])

/**
 * The badge tones the rest of the surface speaks, as hex, because ECharts cannot read a CSS
 * variable. Left to its own palette it colours a healthy state red and a broken one green.
 */
export const BUCKET_COLORS = {
  waiting: "#767b85",
  in_progress: "#215887",
  needs_human: "#822630",
  done: "#065853",
} as const satisfies Record<QueueBucket, string>
