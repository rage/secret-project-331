import type { TFunction } from "i18next"

import type { CreditRegistrationAdminAction } from "@/generated/api/types.generated"

import { widenedLookup } from "./labelFrom"

/** Only the actions that can reach a course's own history; anything else renders its wire name. */
const ACTION_KEYS = {
  retry_item: "credit-registration-action-retry-item",
  retry_failed_for_course: "credit-registration-action-retry-failed-for-course",
  resend_link_email: "credit-registration-action-resend-link-email",
  override_rate_cap: "credit-registration-action-override-rate-cap",
} as const satisfies Partial<Record<CreditRegistrationAdminAction, string>>

export const actionLabel = (t: TFunction, action: CreditRegistrationAdminAction): string => {
  const key = widenedLookup(ACTION_KEYS, action)
  return key ? t(key) : action
}

export const TEACHER_ACTOR_ROLE = "course_teacher"
