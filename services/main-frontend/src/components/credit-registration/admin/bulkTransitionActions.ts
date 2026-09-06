import type { TFunction } from "i18next"

import type {
  CreditRegistrationErrorCode,
  CreditRegistrationState,
} from "@/generated/api/types.generated"

import { registrationLedgerStateLabel } from "../creditRegistrationCopy"
import { canRetryFailure } from "../registrationFailures"
import type { TransitionChoice } from "./TransitionTargetSelect"
import { CANCELLED, CHECK_NOW, CLEAR_ATTENTION, READY_TO_SUBMIT } from "./TransitionTargetSelect"

/** The part of a queue row a bulk action's outcome depends on. */
export interface BulkTransitionRow {
  state: CreditRegistrationState
  error_code?: CreditRegistrationErrorCode | null
}

/** One state's share of a selection: what a bulk move is about to touch. */
export interface SelectionGroup {
  state: CreditRegistrationState
  count: number
}

/**
 * Whether the action could change anything for this row.
 *
 * Not what the server permits — it refuses only rows whose submission outcome is unknown. This is
 * the narrower question of whether the move helps: a `blocked` row sent again is blocked again a
 * second later, and a reversed attainment sent again may register the credits twice.
 */
export const isBulkActionAllowed = (action: TransitionChoice, row: BulkTransitionRow): boolean => {
  switch (action) {
    case READY_TO_SUBMIT:
      return (
        row.state === "failed_retryable" ||
        (row.state === "failed_permanent" && canRetryFailure(row.error_code))
      )
    case CHECK_NOW:
      return row.state === "submission_uncertain" || row.state === "awaiting_verification"
    case CANCELLED:
      // A row whose outcome is unknown may already hold credits in Sisu; the server refuses it.
      return row.state !== "submission_uncertain"
    case CLEAR_ATTENTION:
      return true
  }
}

/** How many of the selected rows the action cannot help — the number a disabled option names. */
export const countBlocking = (
  action: TransitionChoice,
  rows: readonly BulkTransitionRow[],
): number => rows.filter((row) => !isBulkActionAllowed(action, row)).length

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
export const selectionSummary = (t: TFunction, groups: readonly SelectionGroup[]): string[] =>
  groups.map((group) =>
    t("credit-registration-admin-bulk-state-count", {
      count: group.count,
      state: registrationLedgerStateLabel(t, group.state),
    }),
  )
