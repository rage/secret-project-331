import { test } from "@playwright/test"

/**
 * Owns student numbers `9000015xx` and reads the seeded chapter page of
 * `credit-registration-via-suotar`.
 */
test.fixme("The banner renders above readable content and does not block reading the page", () => {
  // Waiting on PR 3's in-course re-enrol banner. Its substance — a working enrolment link on a missing
  // enrolment — is already asserted on the status page in suotar-enrolment-problems.spec.ts.
})

test.fixme("It survives navigation and reload, and disappears once the student re-enrols", () => {
  // Waiting on PR 3's in-course re-enrol banner. Server state, not sessionStorage — a reload catches a
  // client-only implementation.
})

test.fixme("Dismissal hides it, but a fresh enrolment problem brings it back", () => {
  // Waiting on PR 3's in-course re-enrol banner and its dismissal endpoint. The dismissal is cleared
  // when the row re-enters the enrolment-problem state, so dismissing is not a permanent opt-out.
})
