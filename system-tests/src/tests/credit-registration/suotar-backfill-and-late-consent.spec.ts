import { test } from "@playwright/test"

/**
 * Owns the `credit-registration-backfill` course outright and student numbers `9000011xx`. Turning
 * the flag on is a one-way, run-wide change that materialises rows for every student on the
 * course, so this file must be `test.describe.serial` and no other spec may touch that course —
 * dashboard assertions about the resulting wave included, since a parallel worker races the flip.
 */
test.fixme("Enabling the flag backfills existing completions and skips the already-registered one", () => {
  // Waiting on the module editor and materialize.
})

test.fixme("Late consent from the profile page unblocks an existing pending row", () => {
  // Waiting on the give-consent button.
})
