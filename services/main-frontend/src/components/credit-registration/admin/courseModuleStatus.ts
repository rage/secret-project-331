import type { TFunction } from "i18next"

import type { CreditRegistrationCourseStats } from "@/generated/api/types.generated"
import type { BadgeTone } from "@/shared-module/components"

import { TONE } from "../constants"

export type CourseModuleStatus =
  | "broken_config"
  | "config_warning"
  | "double_registering"
  | "failing"
  | "unchecked"
  | "ok"

// A reading aid rather than an alerting rule, so it keeps its own cutoffs rather than reaching for
// the backend's thresholds. Below the minimum a single failure would read as a course on fire.
export const HIGH_FAILURE_RATE_PERCENT = 20
const MIN_TERMINAL_FOR_RATE = 10
const PERCENT = 100

/** Failed share of the module's terminal rows, or `null` while too few have finished to mean anything. */
export const failureRatePercent = (module: CreditRegistrationCourseStats): number | null => {
  const terminal = module.success_count + module.failed_count
  return terminal < MIN_TERMINAL_FOR_RATE ? null : (module.failed_count / terminal) * PERCENT
}

/** Completions the module makes eligible that have no registration yet. */
export const backfillGap = (module: CreditRegistrationCourseStats): number =>
  module.eligible_completion_count - module.registration_count

/**
 * One verdict per module, worst first: an operator scanning the column reads one thing per row.
 * Independent of `paused_at` — pause is a fact an administrator set by hand, shown as its own
 * badge alongside this one rather than swallowed by it.
 */
export const courseModuleStatus = (module: CreditRegistrationCourseStats): CourseModuleStatus => {
  if (module.check.message !== null) {
    // A module that has never registered anything and fails its check cannot register; one that has
    // is a configuration to fix rather than a course whose students are getting nothing.
    return module.success_count === 0 ? "broken_config" : "config_warning"
  }
  if (module.old_flow_also_enabled) {
    return "double_registering"
  }
  if ((failureRatePercent(module) ?? 0) > HIGH_FAILURE_RATE_PERCENT) {
    return "failing"
  }
  if (module.config_checked_at === null) {
    return "unchecked"
  }
  return "ok"
}

const STATUS_KEYS = {
  broken_config: "credit-registration-admin-status-cannot-register",
  config_warning: "credit-registration-admin-status-config-check-failed",
  double_registering: "credit-registration-admin-old-flow-also-enabled",
  failing: "credit-registration-admin-status-failing",
  unchecked: "credit-registration-admin-status-unchecked",
  ok: "credit-registration-admin-status-ok",
} as const satisfies Record<CourseModuleStatus, string>

const STATUS_TONES = {
  broken_config: TONE.DANGER,
  config_warning: TONE.WARNING,
  double_registering: TONE.DANGER,
  failing: TONE.DANGER,
  unchecked: TONE.NEUTRAL,
  ok: TONE.SUCCESS,
} as const satisfies Record<CourseModuleStatus, BadgeTone>

/** The Courses tab's badge text for a module verdict. */
export const courseModuleStatusLabel = (t: TFunction, status: CourseModuleStatus): string =>
  t(STATUS_KEYS[status])

/** The Courses tab's badge tone for a module verdict. */
export const courseModuleStatusTone = (status: CourseModuleStatus): BadgeTone =>
  STATUS_TONES[status]

/**
 * Which of a module's structured configuration checks is failing. `check.message` covers more
 * ground than these two booleans, so a message with neither false is `"other"` — still shown, just
 * without a specific human reason or a place in the grouping banner.
 */
export type ConfigFailureReason = "product_token" | "course_code" | "other"

export const configFailureReason = (
  module: CreditRegistrationCourseStats,
): ConfigFailureReason | null => {
  if (!module.check.message) {
    return null
  }
  if (module.check.product_token_found === false) {
    return "product_token"
  }
  if (module.check.course_code_resolves === false) {
    return "course_code"
  }
  return "other"
}

const CONFIG_FAILURE_REASON_KEYS = {
  product_token: "credit-registration-admin-config-failure-product-token",
  course_code: "credit-registration-admin-config-failure-course-code",
  other: "credit-registration-admin-config-failure-other",
} as const satisfies Record<ConfigFailureReason, string>

/** Human status for a module's failed check, in place of the raw backend message. */
export const configFailureReasonLabel = (t: TFunction, reason: ConfigFailureReason): string =>
  t(CONFIG_FAILURE_REASON_KEYS[reason])

/** `configFailureReason`, defaulting to `"other"` for a caller that already knows `check.message` is set. */
export const configFailureReasonOrOther = (
  module: CreditRegistrationCourseStats,
): ConfigFailureReason => configFailureReason(module) ?? "other"

export interface DominantConfigFailure {
  reason: "product_token" | "course_code"
  count: number
}

/** The structured failure reason shared by the most modules, for the grouping banner above the table. */
export const dominantConfigFailureReason = (
  modules: CreditRegistrationCourseStats[],
): DominantConfigFailure | null => {
  const counts: Partial<Record<"product_token" | "course_code", number>> = {}
  for (const courseModule of modules) {
    const reason = configFailureReason(courseModule)
    if (reason === null || reason === "other") {
      continue
    }
    counts[reason] = (counts[reason] ?? 0) + 1
  }
  const ranked = (Object.entries(counts) as ["product_token" | "course_code", number][]).toSorted(
    (a, b) => b[1] - a[1],
  )
  const top = ranked[0]
  return top === undefined ? null : { reason: top[0], count: top[1] }
}
