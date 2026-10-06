import type { CreditRegistrationState } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

import type { CreditRegistrationTFunction } from "../constants"

/** What a row in this state is waiting for, which is what an operator groups the ledger by. */
export type QueueBucket = "waiting_on_student" | "in_progress" | "needs_a_look" | "failed" | "done"

/**
 * Which bucket each ledger state belongs to. `satisfies` over the whole enum means a state added to
 * the backend fails the build here rather than silently vanishing from the totals.
 *
 * `no_usable_enrolment` is a wait on the student, not a failure: most rows sit there until the
 * student enrols. `blocked` and `submission_uncertain` need a look but have not failed, and
 * `failed_retryable` still retries on its own, so only the two dead ends count as failed.
 *
 * These are pipeline stages, not the "needs a human" attention queue built elsewhere: that queue
 * mixes rows from several stages and excludes failures nothing can be done about.
 */
export const BUCKET_OF_STATE = {
  pending: "waiting_on_student",
  no_usable_enrolment: "waiting_on_student",
  ready_to_submit: "in_progress",
  resolving_enrolment: "in_progress",
  checking_enrolment: "in_progress",
  submitting: "in_progress",
  awaiting_verification: "in_progress",
  partially_registered: "in_progress",
  failed_retryable: "needs_a_look",
  submission_uncertain: "needs_a_look",
  blocked: "needs_a_look",
  failed_permanent: "failed",
  misregistered: "failed",
  registered: "done",
  duplicate: "done",
  not_improved: "done",
  cancelled: "done",
} as const satisfies Record<CreditRegistrationState, QueueBucket>

export const ALL_STATES = Object.keys(BUCKET_OF_STATE) as CreditRegistrationState[]

/** Pipeline order, so a list grouped by bucket reads from newest arrival to finished. */
export const BUCKET_ORDER: QueueBucket[] = [
  "waiting_on_student",
  "in_progress",
  "needs_a_look",
  "failed",
  "done",
]

/** Terminal states only ever grow, so charting or measuring them beside the queues flattens both. */
export const LIVE_BUCKETS: QueueBucket[] = [
  "waiting_on_student",
  "in_progress",
  "needs_a_look",
  "failed",
]

const BUCKET_KEYS = {
  waiting_on_student: "credit-registration-admin-bucket-waiting-on-student",
  in_progress: "credit-registration-admin-bucket-in-progress",
  needs_a_look: "credit-registration-admin-bucket-needs-a-look",
  failed: "credit-registration-admin-bucket-failed",
  done: "credit-registration-admin-bucket-done",
} as const satisfies Record<QueueBucket, string>

export const bucketLabel = (t: CreditRegistrationTFunction, bucket: QueueBucket): string =>
  t(BUCKET_KEYS[bucket])

/**
 * Read off the theme rather than left to ECharts, which colours a healthy state red and a broken
 * one green. Red is for failures alone. Hex and not a CSS variable: ECharts cannot resolve one.
 */
export const BUCKET_COLORS = {
  waiting_on_student: baseTheme.colors.gray[400],
  in_progress: baseTheme.colors.blue[600],
  needs_a_look: baseTheme.colors.yellow[800],
  failed: baseTheme.colors.crimson[600],
  done: baseTheme.colors.green[700],
} as const satisfies Record<QueueBucket, string>
