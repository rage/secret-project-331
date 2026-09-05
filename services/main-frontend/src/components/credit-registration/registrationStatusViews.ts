import type { TFunction } from "i18next"

import type { StudentFacingCreditRegistrationStatus } from "@/generated/api/types.generated"

import { labelFrom } from "./labelFrom"

/**
 * The named narrowings a roster can be put under.
 *
 * One vocabulary for the filter select, the clickable counts in the by-module table and the
 * segments of the summary line, so a count and the rows it opens can never mean different things.
 */
export type RegistrationStatusView =
  | "everyone"
  | "needs_attention"
  | "needs_student_number"
  | "waiting_on_student"
  | "in_progress"
  | "registered"
  | "failed"
  | "not_registering"

export const REGISTRATION_STATUS_VIEWS: RegistrationStatusView[] = [
  "everyone",
  "needs_attention",
  "failed",
  "needs_student_number",
  "waiting_on_student",
  "in_progress",
  "registered",
  "not_registering",
]

export const DEFAULT_REGISTRATION_STATUS_VIEW: RegistrationStatusView = "everyone"

/**
 * The stages a view covers. Empty means "do not narrow at all", not "match nothing".
 *
 * `needs_attention` is the union of the stages someone can still act on, which is what
 * `registrationNeedsAttention` derives per row.
 */
const VIEW_STATUSES = {
  everyone: [],
  needs_attention: ["needs_student_number", "needs_enrolment", "failed"],
  needs_student_number: ["needs_student_number"],
  waiting_on_student: ["waiting_for_completion", "needs_student_number", "needs_enrolment"],
  in_progress: ["in_progress", "waiting_for_sisu"],
  registered: ["registered"],
  failed: ["failed"],
  not_registering: ["not_registering"],
} as const satisfies Record<
  RegistrationStatusView,
  readonly StudentFacingCreditRegistrationStatus[]
>

export const registrationStatusesOf = (
  view: RegistrationStatusView,
): readonly StudentFacingCreditRegistrationStatus[] => VIEW_STATUSES[view]

const VIEW_LABEL_KEYS = {
  everyone: "credit-registration-view-everyone",
  needs_attention: "credit-registration-view-needs-attention",
  needs_student_number: "credit-registration-teacher-status-needs-student-number",
  waiting_on_student: "credit-registration-column-waiting-on-student",
  in_progress: "credit-registration-column-in-progress",
  registered: "credit-registration-teacher-status-registered",
  failed: "credit-registration-teacher-status-failed",
  not_registering: "credit-registration-teacher-status-not-registering",
} as const satisfies Record<RegistrationStatusView, string>

export const registrationStatusViewLabel = (t: TFunction, view: RegistrationStatusView): string =>
  labelFrom(t, VIEW_LABEL_KEYS, view, VIEW_LABEL_KEYS.everyone)
