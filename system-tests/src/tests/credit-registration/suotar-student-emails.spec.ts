import {
  completionRegistrationUrl,
  CRS_101,
  myRegistrationOnCourse,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import {
  adminRegistrationDetails,
  makeRegistrationDueNow,
  type AdminNotificationEmail,
} from "@/utils/creditRegistrationAdmin"
import { transitionMockSuotarSubmissionsFor } from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runProductTokenRefreshTick,
  runResolveEnrolmentsTick,
  runStudentNotificationsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"

/**
 * The only two emails a student ever gets about credit registration: no usable enrolment was found,
 * and the registration succeeded. Owns student numbers `9000013xx`.
 *
 * The workers tick every phase unscoped in the test deployment, so a mail can already be queued
 * before this file asks for one. Every assertion is therefore "exactly one of this kind exists",
 * which is what idempotency by `{action_needed,registered}_email_delivery_id` actually promises.
 */
const REGISTERED_EMAIL = "credit-registration-emails-registered@example.com"
const REGISTERED_STUDENT_NUMBER = "900001301"
const NO_ENROLMENT_EMAIL = "credit-registration-emails-no-enrolment@example.com"
const UNMAILED_EMAIL = "credit-registration-emails-unmailed@example.com"

/**
 * Every value `email_send_status` may take. We can see our own queue, not the recipient's inbox, so
 * there is deliberately no value here that would let a surface claim the mail arrived.
 */
const SEND_STATUSES = ["queued", "retrying", "sent", "send_failed"]

const mailsOfKind = (
  mails: AdminNotificationEmail[],
  kind: AdminNotificationEmail["kind"],
): AdminNotificationEmail[] => mails.filter((mail) => mail.kind === kind)

/**
 * Which mails a row is pinned to, for comparing two reads of it. Deliberately not the whole objects:
 * `send_status` is derived live from the delivery, and the sender runs in this deployment, so it flips
 * `queued` → `sent` between two reads of a mail nobody sent twice. A re-send would replace the
 * delivery id, which is the thing being asserted. Sorted because the endpoint's query has no
 * `ORDER BY`.
 */
const mailIdentities = (mails: AdminNotificationEmail[]): string[] =>
  mails.map((mail) => `${mail.kind}:${mail.email_delivery_id}`).toSorted()

test.describe("A student whose credits reach the study registry", () => {
  test.use({ storageState: seededStudentStorageState(REGISTERED_EMAIL) })

  test("One notifications tick queues the two terminal-state emails and no more", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: REGISTERED_EMAIL }

    const registration = await test.step("Drive the completion to registered", async () => {
      await runMaterializeTick(page.request, scope)
      await runPreconditionsTick(page.request, scope)
      await runResolveEnrolmentsTick(page.request, scope)
      await runImportSubmissionTick(page.request, scope)
      const submitted = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
        "awaiting_verification",
      ])
      await transitionMockSuotarSubmissionsFor(
        page.request,
        REGISTERED_STUDENT_NUMBER,
        "registered",
        CRS_101,
      )
      await makeRegistrationDueNow(adminApi, submitted.id)
      await runVerifyPollTick(page.request, scope)
      return await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
        "registered",
      ])
    })

    const queued = await test.step("Exactly one registered mail is queued", async () => {
      await runStudentNotificationsTick(page.request, scope)
      const details = await adminRegistrationDetails(adminApi, registration.id)
      expect(mailsOfKind(details.notification_emails, "registered")).toHaveLength(1)
      // Nothing else is mailed about a success: no action-needed mail on a row that never parked.
      expect(mailsOfKind(details.notification_emails, "action_needed")).toHaveLength(0)
      return details.notification_emails
    })

    await test.step("A re-tick adds none", async () => {
      // The regression this file exists for: the column, not the tick, is what stops a second send.
      await runStudentNotificationsTick(page.request, scope)
      const details = await adminRegistrationDetails(adminApi, registration.id)
      expect(mailIdentities(details.notification_emails)).toStrictEqual(mailIdentities(queued))
    })

    await test.step("Send status uses our-side vocabulary, never a delivery", async () => {
      for (const mail of queued) {
        expect(SEND_STATUSES).toContain(mail.send_status.email_send_status)
      }
      await page.goto(completionRegistrationUrl(registration.course_module_id))
      await expect(page.getByText("Registered in Sisu").first()).toBeVisible()
      await expect(page.getByText("delivered")).toHaveCount(0)
    })
  })
})

test.describe("A student the study registry has no enrolment for", () => {
  test.use({ storageState: seededStudentStorageState(NO_ENROLMENT_EMAIL) })

  test("Reaching no usable enrolment queues the action-needed email with a working enrolment link", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: NO_ENROLMENT_EMAIL }

    await runMaterializeTick(page.request, scope)
    await runPreconditionsTick(page.request, scope)
    await runResolveEnrolmentsTick(page.request, scope)
    const parked = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "no_usable_enrolment",
    ])

    // Before the mail is composed: the enrolment link is built from the product access token, and a
    // mail queued ahead of the first refresh would carry the degraded copy instead.
    await runProductTokenRefreshTick(page.request, { courseSlug: SUOTAR_COURSE_SLUG })
    await runStudentNotificationsTick(page.request, scope)
    const queued = await adminRegistrationDetails(adminApi, parked.id)
    expect(mailsOfKind(queued.notification_emails, "action_needed")).toHaveLength(1)
    expect(mailsOfKind(queued.notification_emails, "registered")).toHaveLength(0)

    // The mail's `ENROLMENT_LINK` placeholder is built by the same helper that fills this field, so
    // a link here is a link in the message; a bare "enrol in Sisu" would leave the student stuck.
    const mine = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)
    expect(mine.enrolment_link).not.toBeNull()

    await runStudentNotificationsTick(page.request, scope)
    const afterSecond = await adminRegistrationDetails(adminApi, parked.id)
    expect(mailIdentities(afterSecond.notification_emails)).toStrictEqual(
      mailIdentities(queued.notification_emails),
    )
  })
})

test.describe("A student who was never asked for consent", () => {
  test.use({ storageState: seededStudentStorageState(UNMAILED_EMAIL) })

  test("A row that is in neither the success nor the enrolment state is mailed nothing", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: UNMAILED_EMAIL }
    await runMaterializeTick(page.request, scope)
    await runPreconditionsTick(page.request, scope)
    const waiting = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "pending",
    ])

    await runStudentNotificationsTick(page.request, scope)
    const details = await adminRegistrationDetails(adminApi, waiting.id)
    expect(details.notification_emails).toStrictEqual([])
  })
})
