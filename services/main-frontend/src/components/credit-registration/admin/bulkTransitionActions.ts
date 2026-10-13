import type {
  CreditRegistrationState,
  HandActionAvailability,
  ResubmissionRisk,
} from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"
import { adminLedgerStateLabel } from "./adminCreditRegistrationCopy"
import type { TransitionChoice } from "./TransitionTargetSelect"
import { CANCELLED, CHECK_NOW, CLEAR_ATTENTION, READY_TO_SUBMIT } from "./TransitionTargetSelect"

/** The part of a queue row a bulk action's outcome depends on. */
export interface BulkTransitionRow {
  state: CreditRegistrationState
  hand_actions: HandActionAvailability
}

/** One state's share of a selection: what a bulk move is about to touch. */
export interface SelectionGroup {
  state: CreditRegistrationState
  count: number
}

/** Whether the server applies the action to this row rather than skipping it. */
export const isBulkActionAllowed = (action: TransitionChoice, row: BulkTransitionRow): boolean => {
  switch (action) {
    case READY_TO_SUBMIT:
      return row.hand_actions.resubmission.kind === "allowed"
    case CHECK_NOW:
      return (row.hand_actions.check_now ?? null) !== null
    case CANCELLED:
      return (row.hand_actions.cancel_refusal ?? null) === null
    case CLEAR_ATTENTION:
      return true
  }
}

/** How many of the selected rows the server would skip for this action. */
export const countSkipped = (
  action: TransitionChoice,
  rows: readonly BulkTransitionRow[],
): number => rows.filter((row) => !isBulkActionAllowed(action, row)).length

/** How many of the rows a resend would go to carry this risk. */
export const countResubmissionRisk = (
  risk: ResubmissionRisk,
  rows: readonly BulkTransitionRow[],
): number =>
  rows.filter(
    (row) =>
      row.hand_actions.resubmission.kind === "allowed" &&
      row.hand_actions.resubmission.risk === risk,
  ).length

/** The selection by state, commonest first, so a dialog leads with what most of it is. */
export const groupSelectionByState = (rows: readonly BulkTransitionRow[]): SelectionGroup[] => {
  const counts = new Map<CreditRegistrationState, number>()
  for (const row of rows) {
    counts.set(row.state, (counts.get(row.state) ?? 0) + 1)
  }
  return Array.from(counts, ([state, count]) => ({ state, count })).toSorted(
    (a, b) => b.count - a.count,
  )
}

/** The selection in words: "18 waiting for Sisu to confirm", one entry per state. */
export const selectionSummary = (
  t: CreditRegistrationTFunction,
  groups: readonly SelectionGroup[],
): string[] =>
  groups.map((group) =>
    t("credit-registration-admin-bulk-state-count", {
      count: group.count,
      state: adminLedgerStateLabel(t, group.state),
    }),
  )
