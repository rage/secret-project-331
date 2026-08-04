import { test } from "@playwright/test"

/**
 * Owns student numbers `9000002xx` and the three fixed tokens seeded by
 * `seed_credit_registration.rs` (`LINKING_TOKEN_VALID` / `_EXPIRED` / `_ALREADY_USED`).
 */
test.fixme("Opening a valid verification link links the student number", () => {
  // Waiting on the landing page.
})

test.fixme("An expired verification link shows an expired-link message", () => {
  // Waiting on the landing page.
})

test.fixme("An already-used verification link shows an already-used message, not success", () => {
  // Waiting on the landing page. Assert the copy differs from the expired case.
})

test.fixme("A non-matching account links after confirmation, and a plain GET consumes nothing", () => {
  // Waiting on the landing page. The token carries no user id, so the confirmation step is
  // the only safeguard; not linking on GET stops mail scanners from consuming tokens.
})
