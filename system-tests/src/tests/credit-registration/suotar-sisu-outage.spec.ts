import { test } from "@playwright/test"

/**
 * Owns student numbers `9000006xx`. Fault injection that makes *every* call fail affects
 * every other spec running in parallel, so anything global belongs in a serial file of its own.
 */
test.fixme("An outage backs off, surfaces one configuration-level alarm, and recovers", () => {
  // Waiting on the backoff design. One alarm, not thousands of per-student errors, and no student's
  // completion marked failed.
})
