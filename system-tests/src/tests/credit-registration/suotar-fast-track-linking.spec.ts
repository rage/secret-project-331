import type { APIRequestContext } from "@playwright/test"

import {
  ORIGIN,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { adminResolveStudentNumber } from "@/utils/creditRegistrationAdmin"
import { expect, test } from "@/utils/fixtures"
import {
  queuedEmailsFor,
  runEnrolmentDiscoveryTick,
  runLinkEmailsTick,
  runMaterializeTick,
  runPreconditionsTick,
} from "@/utils/suotarControl"

/**
 * Owns student numbers `9000014xx`. Every account here holds a confirmed email address except
 * `900001402`, so what separates the fixtures is only the thing each one is named after.
 *
 * Serial and order-dependent: the last test unlinks `900001401`, and an automatic link the student
 * has removed is never made again, so nothing after it may expect that number linked.
 * `retries: 0` follows: a retry replays the group from its first test, which by then would run against
 * the unlinked number and an already-claimed mail, so retrying only turns one failure into three.
 */
const VERIFIED_EMAIL = "credit-registration-verified-email@example.com"
const VERIFIED = "900001401"
const UNVERIFIED_TWIN = "900001402"
const STALE_PROOF = "900001403"
const NAME_MISMATCH = "900001404"
const HAS_OTHER_NUMBER = "900001405"
const SECONDARY_ONLY = "900001406"
const NO_MATCH = "900001407"

const FAST_TRACK = "email_match_fast_track"
const LINKED_MAIL = "credit_registration_student_number_linked"
const STUDENT_NUMBER_SETTINGS_URL = `${ORIGIN}/user-settings/student-number`

test.describe.configure({ mode: "serial", retries: 0 })

test.use({ storageState: seededStudentStorageState(VERIFIED_EMAIL) })

const courseScope = { courseSlug: SUOTAR_COURSE_SLUG }

/**
 * Both phases, because the fast track's whole claim is about the mail: discovery decides, and only
 * the mailing phase turns a claimed slot into a queued message.
 */
const runDiscoveryAndMailing = async (request: APIRequestContext) => {
  await runEnrolmentDiscoveryTick(request, courseScope)
  await runLinkEmailsTick(request, courseScope)
}

test("A verified email match auto-links, queues no linking mail, and unblocks the registration", async ({
  page,
  adminApi,
}) => {
  await runDiscoveryAndMailing(page.request)

  await test.step("The link exists and says how it was proved", async () => {
    const resolved = await adminResolveStudentNumber(adminApi, VERIFIED)
    expect(resolved.already_linked_to_user_id).not.toBeNull()
    // Never indistinguishable from a link the student made by opening a mailed link.
    expect(resolved.already_linked_via).toBe(FAST_TRACK)
  })

  await test.step("No linking mail was ever claimed for this person", async () => {
    // The saving is the feature: a claimed slot here would mean the student still has to click.
    const resolved = await adminResolveStudentNumber(adminApi, VERIFIED)
    expect(resolved.linking_emails).toHaveLength(0)
  })

  await test.step("The registration unblocks with no click at all", async () => {
    await runMaterializeTick(page.request, { userEmail: VERIFIED_EMAIL })
    await runPreconditionsTick(page.request, { userEmail: VERIFIED_EMAIL })
    const row = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "ready_to_submit",
      "submitted",
      "awaiting_verification",
      "registered",
    ])
    expect(row.superseded).toBe(false)
  })
})

test("An unverified email match does not auto-link", async ({ page, adminApi }) => {
  await runDiscoveryAndMailing(page.request)

  const resolved = await adminResolveStudentNumber(adminApi, UNVERIFIED_TWIN)
  // Without a proof of the address, equality with an account's email is an impersonation primitive:
  // the address is self-service editable through the ordinary profile form.
  expect(resolved.already_linked_to_user_id).toBeNull()
  expect(resolved.linking_emails.length).toBeGreaterThan(0)
})

test("A stale, secondary-only, name-mismatched or already-numbered match does not auto-link", async ({
  page,
  adminApi,
}) => {
  await runDiscoveryAndMailing(page.request)

  for (const studentNumber of [STALE_PROOF, SECONDARY_ONLY, NAME_MISMATCH]) {
    const resolved = await adminResolveStudentNumber(adminApi, studentNumber)
    expect(
      resolved.already_linked_to_user_id,
      `${studentNumber} must not be auto-linked`,
    ).toBeNull()
    expect(
      resolved.linking_emails.length,
      `${studentNumber} must be mailed a link`,
    ).toBeGreaterThan(0)
  }

  await test.step("An account that already holds a number keeps it", async () => {
    // Swapping a linked number belongs behind the mailed link's confirmation screen, which names
    // both numbers, not in a background worker.
    const resolved = await adminResolveStudentNumber(adminApi, HAS_OTHER_NUMBER)
    expect(resolved.already_linked_to_user_id).toBeNull()
    expect(resolved.linking_emails.length).toBeGreaterThan(0)
  })
})

test("A person the fast track cannot help still gets the linking email", async ({
  page,
  adminApi,
}) => {
  // The regression that matters most. This account's address is confirmed and recent; the registry
  // simply holds a different one for the person, which is the entire population the linking mail
  // exists for. A fast track that filtered instead of branching would strand them.
  await runDiscoveryAndMailing(page.request)

  const resolved = await adminResolveStudentNumber(adminApi, NO_MATCH)
  expect(resolved.already_linked_to_user_id).toBeNull()
  expect(resolved.linking_emails.length).toBeGreaterThan(0)
})

test("Every auto-link notifies the verified address and can be unlinked in one click", async ({
  page,
  adminApi,
}) => {
  await runEnrolmentDiscoveryTick(page.request, courseScope)

  await test.step("The notification names the number and carries the unlink link", async () => {
    // A compensating control, not a nicety: it goes to the one asset an attacker holding the
    // session does not have, and it is how a wrong automatic link becomes detectable at all.
    const mails = await queuedEmailsFor(page.request, VERIFIED_EMAIL)
    const linkedMails = mails.filter((mail) => mail.templateType === LINKED_MAIL)
    expect(linkedMails.length).toBeGreaterThan(0)
    expect(linkedMails[0]?.placeholders.STUDENT_NUMBER).toBe(VERIFIED)
    expect(linkedMails[0]?.placeholders.LINK).toBe(STUDENT_NUMBER_SETTINGS_URL)
  })

  await test.step("The in-app notice renders and unlinks in one click", async () => {
    await page.goto(STUDENT_NUMBER_SETTINGS_URL)
    const notice = page.getByTestId("auto-link-notice")
    await expect(notice).toBeVisible()
    await expect(notice.getByText(VERIFIED)).toBeVisible()

    await notice.getByRole("button", { name: "Not mine, remove it" }).click()
    await page.getByRole("button", { name: "Yes" }).click()
    await expect(page.getByText("No student number is linked to this account yet.")).toBeVisible()
  })

  await test.step("A later tick does not re-link, so the unlink is not theatre", async () => {
    await runDiscoveryAndMailing(page.request)
    const resolved = await adminResolveStudentNumber(adminApi, VERIFIED)
    expect(resolved.already_linked_to_user_id).toBeNull()
    // The student is not left stranded either: the ordinary mailed link takes over.
    expect(resolved.linking_emails.length).toBeGreaterThan(0)
  })
})
