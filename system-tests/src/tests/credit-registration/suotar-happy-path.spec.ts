import { test } from "@playwright/test"

/**
 * Owns student numbers `9000001xx` (see `seed_credit_registration.rs`). Doubles as the
 * integration test of the tick endpoints and the mock control API, so nothing else in this
 * directory is trustworthy until it passes.
 */
test.fixme("Student consents, links student number, gets automatically registered end to end", () => {
  // Waiting on the pipeline.
})
