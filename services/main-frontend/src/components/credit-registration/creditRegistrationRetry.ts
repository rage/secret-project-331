import type { TFunction } from "i18next"

import type {
  CreditRegistrationAdminAction,
  RetryCreditRegistrationOutcome,
} from "@/generated/api/types.generated"

import { labelFrom, widenedLookup } from "./labelFrom"

const RETRY_OUTCOME_KEYS = {
  retried: "credit-registration-retry-retried",
  refused_submission_uncertain: "credit-registration-retry-refused-submission-uncertain",
  refused_consent_withdrawn: "credit-registration-retry-refused-consent-withdrawn",
  refused_without_consent: "credit-registration-retry-refused-without-consent",
  refused_not_failed: "credit-registration-retry-refused-not-failed",
  refused_superseded: "credit-registration-retry-refused-superseded",
} as const satisfies Record<RetryCreditRegistrationOutcome, string>

export const RETRIED: RetryCreditRegistrationOutcome = "retried"

export const retryOutcomeSentence = (t: TFunction, outcome: RetryCreditRegistrationOutcome) =>
  labelFrom(t, RETRY_OUTCOME_KEYS, outcome, RETRY_OUTCOME_KEYS.refused_not_failed)

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
