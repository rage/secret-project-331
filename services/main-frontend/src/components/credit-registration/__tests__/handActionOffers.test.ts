import type { AdminCreditRegistrationRow } from "@/generated/api/types.generated"

import type { RemedyOffer } from "../admin/handActionOffers"
import { handActionOffers } from "../admin/handActionOffers"

type OfferRow = Pick<AdminCreditRegistrationRow, "state" | "error_code" | "hand_actions">

const ALL_REMEDIES = new Set<RemedyOffer>([
  "fix_module_configuration",
  "email_student",
  "link_student_number_by_hand",
  "resend_student_number_link",
])

const row = (
  state: OfferRow["state"],
  errorCode: NonNullable<OfferRow["error_code"]>,
  handActions: Partial<OfferRow["hand_actions"]> = {},
): OfferRow => ({
  state,
  error_code: errorCode,
  hand_actions: {
    resubmission: { kind: "allowed", risk: "normal" },
    cancel_refusal: null,
    check_now: null,
    ...handActions,
  },
})

describe("the actions one registration is offered", () => {
  test("a rejection a resend repeats is offered the resend, recommending nothing", () => {
    expect(
      handActionOffers(
        row("failed_permanent", "sisu_validation_failed", {
          resubmission: { kind: "allowed", risk: "likely_rejected_again" },
        }),
        ALL_REMEDIES,
      ),
    ).toEqual({ offers: ["resubmit"], recommended: null })
  })

  test("a settings failure leads with the settings, then the resend", () => {
    expect(handActionOffers(row("failed_permanent", "invalid_credits"), ALL_REMEDIES)).toEqual({
      offers: ["fix_module_configuration", "resubmit"],
      recommended: "fix_module_configuration",
    })
  })

  test("a backoff is cut short before anything is rebuilt", () => {
    expect(
      handActionOffers(
        row("failed_retryable", "service_temporarily_unavailable", { check_now: "next_attempt" }),
        ALL_REMEDIES,
      ),
    ).toEqual({ offers: ["check_now", "resubmit"], recommended: "check_now" })
  })

  test("an uncertain submission leads with the check, whatever its error code says", () => {
    expect(
      handActionOffers(
        row("submission_uncertain", "sisu_timeout", {
          check_now: "attainment",
          resubmission: { kind: "allowed", risk: "possible_duplicate" },
        }),
        ALL_REMEDIES,
      ),
    ).toEqual({ offers: ["check_now", "resubmit"], recommended: "check_now" })
  })

  test("a remedy the page cannot render is left out without promoting the next", () => {
    expect(
      handActionOffers(
        row("no_usable_enrolment", "enrolment_not_found", {
          check_now: "enrolment",
          resubmission: { kind: "refused", refusal: "still_in_pipeline", available_at: null },
        }),
        new Set<RemedyOffer>(),
      ),
    ).toEqual({ offers: ["check_now"], recommended: null })
  })
})
