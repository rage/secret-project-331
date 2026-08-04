import { test } from "@playwright/test"

/**
 * Owns student numbers `9000008xx`. Needs a second teacher context for the authorization cases.
 */
test.fixme("A teacher sees registration status and the verified student number for their course", () => {
  // Waiting on the manage-course views.
})

test.fixme("A teacher of another course cannot act on this course's registrations", () => {
  // Waiting on the teacher endpoints. Authorization is against the target row's course, never a
  // course id taken from the path.
})

test.fixme("Teacher resend is refused by the rate cap and cannot be overridden", () => {
  // Waiting on resend. Only a global admin may override, and then a reason is required.
})

test.fixme("A teacher retries a failed registration and sees it in the action history", () => {
  // Waiting on teacher retry.
})
