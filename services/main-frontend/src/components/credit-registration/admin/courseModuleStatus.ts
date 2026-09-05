import type { TFunction } from "i18next"

import type { CreditRegistrationCourseStats } from "@/generated/api/types.generated"
import type { BadgeTone } from "@/shared-module/components"

import { TONE } from "../constants"

export type CourseModuleStatus =
  | "broken_config"
  | "double_registering"
  | "paused"
  | "failing"
  | "unchecked"
  | "ok"

// A reading aid rather than an alerting rule, so it keeps its own cutoffs rather than reaching for
// the backend's thresholds. Below the minimum a single failure would read as a course on fire.
const HIGH_FAILURE_RATE_PERCENT = 20
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

/** One verdict per module, worst first: an operator scanning the column reads one thing per row. */
export const courseModuleStatus = (module: CreditRegistrationCourseStats): CourseModuleStatus => {
  if (
    module.check.course_code_resolves === false ||
    module.check.product_token_found === false ||
    module.check.message !== null
  ) {
    return "broken_config"
  }
  if (module.old_flow_also_enabled) {
    return "double_registering"
  }
  if (module.paused_at) {
    return "paused"
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
  broken_config: "credit-registration-admin-status-broken-config",
  paused: "credit-registration-admin-module-paused",
  double_registering: "credit-registration-admin-old-flow-also-enabled",
  failing: "credit-registration-admin-status-failing",
  unchecked: "credit-registration-admin-never-config-checked",
  ok: "credit-registration-admin-status-ok",
} as const satisfies Record<CourseModuleStatus, string>

const STATUS_TONES = {
  broken_config: TONE.DANGER,
  paused: TONE.NEUTRAL,
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
