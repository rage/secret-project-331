import { test } from "@playwright/test"

/**
 * Owns student numbers `9000014xx`: the seeded verified-email student and the unverified near-miss
 * twin. Verifying an account email is a one-way, run-wide change, so this file must be serial and own
 * both accounts outright.
 */
test.fixme("A verified email match auto-links, queues no linking mail, and unblocks the registration", () => {
  // Waiting on PR 3's email-match fast track.
})

test.fixme("An unverified email match does not auto-link", () => {
  // Waiting on PR 3's email-match fast track. Without a verified address, an email match is an
  // impersonation primitive.
})

test.fixme("A secondary-email match and a stale verification do not auto-link", () => {
  // Waiting on PR 3's email-match fast track. Primary address only, and inside the configured recency
  // bound.
})

test.fixme("Every auto-link notifies the verified address and can be unlinked in one click", () => {
  // Waiting on PR 3's email-match fast track and its compensating controls.
})
