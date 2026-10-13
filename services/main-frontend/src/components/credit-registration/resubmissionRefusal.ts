import type { ResubmissionRefusal } from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "./constants"
import { labelFrom } from "./labelFrom"

const REFUSAL_KEYS = {
  superseded: "credit-registration-refusal-superseded",
  already_succeeded: "credit-registration-refusal-already-succeeded",
  submission_uncertain: "credit-registration-refusal-submission-uncertain",
  submission_uncertain_too_recent: "credit-registration-refusal-submission-uncertain-too-recent",
  not_failed_permanent: "credit-registration-refusal-not-failed-permanent",
  still_in_pipeline: "credit-registration-refusal-still-in-pipeline",
  submission_pending: "credit-registration-refusal-submission-pending",
  already_submitted: "credit-registration-refusal-already-submitted",
  awaiting_confirmation: "credit-registration-refusal-awaiting-confirmation",
  already_cancelled: "credit-registration-refusal-already-cancelled",
  nothing_to_check: "credit-registration-refusal-nothing-to-check",
} as const satisfies Record<ResubmissionRefusal, string>

const REFUSAL_UNKNOWN_KEY = "credit-registration-refusal-unknown"

/**
 * Why the server refused a hand action on a row. The same wording serves the teacher and admin
 * surfaces, both as a standalone explanation and after the colon of a bulk skip line.
 */
export const refusalSentence = (
  t: CreditRegistrationTFunction,
  refusal: ResubmissionRefusal | null | undefined,
): string =>
  refusal ? labelFrom(t, REFUSAL_KEYS, refusal, REFUSAL_UNKNOWN_KEY) : t(REFUSAL_UNKNOWN_KEY)

/** Refusals that report no failure at all, which is nothing for a teacher to be told about. */
export const isUneventfulRefusal = (refusal: ResubmissionRefusal): boolean =>
  refusal === "not_failed_permanent" ||
  refusal === "already_succeeded" ||
  refusal === "already_submitted"
