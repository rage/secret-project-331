import { test } from "@playwright/test"

/**
 * The only two emails a student ever gets about credit registration: no usable enrolment was found,
 * and the registration succeeded. Owns student numbers `9000013xx`.
 */
test.fixme("One notifications tick queues the two terminal-state emails and no more", () => {
  // Waiting on PR 3's student-notifications phase and its two templates.
})

test.fixme("Send status uses our-side vocabulary: sent from our system, never delivered", () => {
  // Waiting on PR 3's student-notifications phase. We can see our own queue, not the recipient's
  // inbox. The same rule is asserted for the linking mail in suotar-student-profile.spec.ts.
})
