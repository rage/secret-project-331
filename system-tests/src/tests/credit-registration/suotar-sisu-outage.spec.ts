import { test } from "@playwright/test"

/**
 * Owns student numbers `9000006xx`. Fault injection that makes *every* call fail affects every other
 * spec running in parallel, so anything global belongs in a serial file of its own.
 */
test.fixme("An outage backs off, surfaces one configuration-level alarm, and recovers", () => {
  // Waiting on PR 3's errors-and-stuck tab and the remaining alert rules. The circuit breaker tile
  // reads a per-process key, so an outage narrowed to one course cannot be asserted on the banner and
  // a global one would fail every spec running beside it.
})
