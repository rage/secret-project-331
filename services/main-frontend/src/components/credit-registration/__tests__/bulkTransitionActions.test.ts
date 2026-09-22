import type { BulkTransitionRow } from "../admin/bulkTransitionActions"
import {
  countBlocking,
  groupSelectionByState,
  isBulkActionAllowed,
} from "../admin/bulkTransitionActions"
import {
  CANCELLED,
  CHECK_NOW,
  CLEAR_ATTENTION,
  READY_TO_SUBMIT,
} from "../admin/TransitionTargetSelect"

const row = (
  state: BulkTransitionRow["state"],
  errorCode?: BulkTransitionRow["error_code"],
): BulkTransitionRow => ({ state, error_code: errorCode ?? null })

describe("which bulk moves a selection allows", () => {
  test("offers a resend only where sending again could get through", () => {
    expect(isBulkActionAllowed(READY_TO_SUBMIT, row("failed_retryable"))).toBe(true)
    expect(
      isBulkActionAllowed(READY_TO_SUBMIT, row("failed_permanent", "sisu_temporarily_unavailable")),
    ).toBe(true)
    expect(isBulkActionAllowed(READY_TO_SUBMIT, row("failed_permanent", "person_not_found"))).toBe(
      false,
    )
    expect(isBulkActionAllowed(READY_TO_SUBMIT, row("blocked", "missing_uh_course_code"))).toBe(
      false,
    )
    expect(isBulkActionAllowed(READY_TO_SUBMIT, row("misregistered", "misregistered"))).toBe(false)
    expect(isBulkActionAllowed(READY_TO_SUBMIT, row("submission_uncertain", "sisu_timeout"))).toBe(
      false,
    )
  })

  test("offers a registry check only where the outcome is what is unknown", () => {
    expect(isBulkActionAllowed(CHECK_NOW, row("submission_uncertain", "sisu_timeout"))).toBe(true)
    expect(isBulkActionAllowed(CHECK_NOW, row("awaiting_verification"))).toBe(true)
    expect(isBulkActionAllowed(CHECK_NOW, row("blocked"))).toBe(false)
  })

  test("refuses to cancel a row that may already hold credits", () => {
    expect(isBulkActionAllowed(CANCELLED, row("submission_uncertain", "sisu_timeout"))).toBe(false)
    expect(isBulkActionAllowed(CANCELLED, row("failed_permanent", "person_not_found"))).toBe(true)
  })

  test("allows dismissing the flag on anything", () => {
    expect(isBulkActionAllowed(CLEAR_ATTENTION, row("submission_uncertain", "sisu_timeout"))).toBe(
      true,
    )
    expect(isBulkActionAllowed(CLEAR_ATTENTION, row("blocked"))).toBe(true)
  })

  test("counts the rows an action cannot help", () => {
    const selection = [
      row("failed_retryable"),
      row("blocked", "missing_ects_credits"),
      row("failed_permanent", "person_not_found"),
    ]
    expect(countBlocking(READY_TO_SUBMIT, selection)).toBe(2)
    expect(countBlocking(CLEAR_ATTENTION, selection)).toBe(0)
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
