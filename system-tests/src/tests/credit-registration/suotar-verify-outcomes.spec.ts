import { test } from "@playwright/test"

/**
 * Needs the single-phase `verify` tick so verification runs twice without re-running the import.
 * Owns student numbers `9000005xx`.
 */
test.fixme("Polling stays in waiting until Sisu confirms, then flips to registered", () => {
  // Waiting on the verify phase.
})

test.fixme("Duplicate, not-improved and misregistered each reach their own terminal state", () => {
  // Waiting on the verify phase. Duplicate and not-improved count as successes; misregistered does
  // not.
})
