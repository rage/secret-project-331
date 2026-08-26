import type { TFunction } from "i18next"

import type { ResubmissionRefusal } from "@/generated/api/types.generated"

import { labelFrom } from "./labelFrom"

const REFUSAL_KEYS = {
  superseded: "credit-registration-refusal-superseded",
  already_succeeded: "credit-registration-refusal-already-succeeded",
  submission_uncertain: "credit-registration-refusal-submission-uncertain",
  consent_withdrawn: "credit-registration-refusal-consent-withdrawn",
  not_failed_permanent: "credit-registration-refusal-not-failed-permanent",
  without_consent: "credit-registration-refusal-without-consent",
} as const satisfies Record<ResubmissionRefusal, string>

const REFUSAL_UNKNOWN_KEY = "credit-registration-refusal-unknown"

/**
 * Why the server would not resubmit a row. The same wording serves the teacher and admin surfaces,
 * both as a standalone explanation and after the colon of a bulk skip line.
 */
export const refusalSentence = (
  t: TFunction,
  refusal: ResubmissionRefusal | null | undefined,
): string =>
  refusal ? labelFrom(t, REFUSAL_KEYS, refusal, REFUSAL_UNKNOWN_KEY) : t(REFUSAL_UNKNOWN_KEY)

/** Refusals that report no failure at all, which is nothing for a teacher to be told about. */
export const isUneventfulRefusal = (refusal: ResubmissionRefusal): boolean =>
  refusal === "not_failed_permanent" || refusal === "already_succeeded"
