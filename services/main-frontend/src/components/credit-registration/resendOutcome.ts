import type { TFunction } from "i18next"

import type { ResendOutcome } from "@/generated/api/types.generated"

import { labelFrom } from "./labelFrom"

const RESEND_OUTCOME_KEYS = {
  queued: "credit-registration-resend-queued",
  already_mailed_to_every_known_address: "credit-registration-resend-already-mailed",
  refused_by_rate_cap: "credit-registration-resend-refused-by-rate-cap",
  no_address_in_study_registry: "credit-registration-resend-no-address",
  not_on_the_course_roster: "credit-registration-resend-not-on-roster",
  no_student_number_known: "credit-registration-resend-no-student-number",
  already_linked: "credit-registration-resend-already-linked",
  study_registry_unavailable: "credit-registration-resend-registry-unavailable",
} as const satisfies Record<ResendOutcome, string>

const RESEND_OUTCOME_UNKNOWN_KEY = "credit-registration-resend-unknown-outcome"

export const RESEND_QUEUED: ResendOutcome = "queued"

/** An unrecognised outcome must not fall back to `queued`: that reads as the resend having worked. */
export const resendOutcomeLabel = (t: TFunction, outcome: ResendOutcome): string =>
  labelFrom(t, RESEND_OUTCOME_KEYS, outcome, RESEND_OUTCOME_UNKNOWN_KEY)
