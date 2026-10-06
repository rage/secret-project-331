import type { HandActionAvailability } from "@/generated/api/types.generated"

import type { BulkTransitionRow } from "../admin/bulkTransitionActions"
import {
  countResubmissionRisk,
  countSkipped,
  groupSelectionByState,
  isBulkActionAllowed,
} from "../admin/bulkTransitionActions"
import {
  CANCELLED,
  CHECK_NOW,
  CLEAR_ATTENTION,
  READY_TO_SUBMIT,
} from "../admin/TransitionTargetSelect"

const REFUSED_RESEND: HandActionAvailability["resubmission"] = {
  kind: "refused",
  refusal: "submission_uncertain",
  available_at: null,
}

const row = (
  state: BulkTransitionRow["state"],
  handActions: Partial<HandActionAvailability> = {},
): BulkTransitionRow => ({
  state,
  hand_actions: {
    resubmission: { kind: "allowed", risk: "normal" },
    cancel_refusal: null,
    check_now: null,
    ...handActions,
  },
})

describe("which bulk moves a selection allows", () => {
  test("follows the server's rule for each row", () => {
    expect(isBulkActionAllowed(READY_TO_SUBMIT, row("failed_permanent"))).toBe(true)
    expect(
      isBulkActionAllowed(
        READY_TO_SUBMIT,
        row("submission_uncertain", { resubmission: REFUSED_RESEND }),
      ),
    ).toBe(false)
    expect(
      isBulkActionAllowed(CHECK_NOW, row("awaiting_verification", { check_now: "attainment" })),
    ).toBe(true)
    expect(isBulkActionAllowed(CHECK_NOW, row("failed_permanent"))).toBe(false)
    expect(
      isBulkActionAllowed(CANCELLED, row("submitting", { cancel_refusal: "already_submitted" })),
    ).toBe(false)
    expect(isBulkActionAllowed(CLEAR_ATTENTION, row("submission_uncertain"))).toBe(true)
  })

  test("counts the rows an action would skip", () => {
    const selection = [
      row("failed_permanent"),
      row("submission_uncertain", { resubmission: REFUSED_RESEND }),
      row("misregistered", {
        resubmission: { kind: "allowed", risk: "replaces_reversed_attainment" },
      }),
    ]
    expect(countSkipped(READY_TO_SUBMIT, selection)).toBe(1)
    expect(countSkipped(CLEAR_ATTENTION, selection)).toBe(0)
  })

  test("counts resend risks among the rows a resend goes to", () => {
    const selection = [
      row("failed_permanent", { resubmission: { kind: "allowed", risk: "likely_rejected_again" } }),
      row("failed_permanent", { resubmission: { kind: "allowed", risk: "likely_rejected_again" } }),
      row("failed_retryable"),
      row("submission_uncertain", { resubmission: REFUSED_RESEND }),
    ]
    expect(countResubmissionRisk("likely_rejected_again", selection)).toBe(2)
    expect(countResubmissionRisk("possible_duplicate", selection)).toBe(0)
  })
})

describe("summarising a selection", () => {
  test("groups by state, commonest first", () => {
    expect(
      groupSelectionByState([
        row("blocked"),
        row("failed_permanent"),
        row("blocked"),
        row("blocked"),
      ]),
    ).toEqual([
      { state: "blocked", count: 3 },
      { state: "failed_permanent", count: 1 },
    ])
  })
})
