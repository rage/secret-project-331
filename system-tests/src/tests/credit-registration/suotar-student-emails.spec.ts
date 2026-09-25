import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  completionRegistrationUrl,
  CREDIT_REGISTRATION_STUDENT_2,
  CRS_101,
  CRS_B_101_ENROLMENT_LINK,
  myRegistrationOnCourse,
  seededStudentStorageState,
  STUDENT_8,
  SUOTAR_B_COURSE_SLUG,
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
  runMaterializeTick,
  runPhasesUpToSubmission,
  runPreconditionsTick,
  runStudentNotificationsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"

/**
 * The only two emails a student ever gets about credit registration: the registration waits for
 * their enrolment, and the registration succeeded. Owns `credit-registration-student-2` on
 * `via-suotar` and `student8` on `via-suotar-b`.
 *
 * The workers tick every phase unscoped in the test deployment, so a mail can already be queued
 * before this file asks for one. Every assertion is therefore "exactly one of this kind exists",
 * which is what idempotency by `{action_needed,registered}_email_delivery_id` actually promises.
 */
const REGISTERED_EMAIL = CREDIT_REGISTRATION_STUDENT_2.email
const REGISTERED_STUDENT_NUMBER = CREDIT_REGISTRATION_STUDENT_2.studentNumber
const NO_ENROLMENT_EMAIL = STUDENT_8.email

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
    const scope = { userEmail: REGISTERED_EMAIL, courseSlug: SUOTAR_COURSE_SLUG }

    const registration = await test.step("Drive the completion to registered", async () => {
      await runPhasesUpToSubmission(page.request, scope)
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
      // Its wait for the first check is mailed at most once, if the workers ran while it waited.
      expect(mailsOfKind(details.notification_emails, "action_needed").length).toBeLessThanOrEqual(
        1,
      )
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

    await test.step("The status page is accessible once the row is registered", async () => {
      await accessibilityCheck(page, "Credit registration status page")
    })
  })
})

test.describe("A student the study registry has no enrolment for", () => {
  test.use({ storageState: seededStudentStorageState(NO_ENROLMENT_EMAIL) })

  test("Reaching no usable enrolment queues the action-needed email with a working enrolment link", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: NO_ENROLMENT_EMAIL, courseSlug: SUOTAR_B_COURSE_SLUG }

    // The row waits a day for its first check, and the student is told what to do meanwhile.
    await runMaterializeTick(page.request, scope)
    await runPreconditionsTick(page.request, scope)
    const parked = await waitForRegistrationState(page.request, adminApi, SUOTAR_B_COURSE_SLUG, [
      "no_usable_enrolment",
    ])
    expect(parked.student_facing_status).toBe("needs_enrolment")

    await runStudentNotificationsTick(page.request, scope)
    const queued = await adminRegistrationDetails(adminApi, parked.id)
    expect(mailsOfKind(queued.notification_emails, "action_needed")).toHaveLength(1)
    expect(mailsOfKind(queued.notification_emails, "registered")).toHaveLength(0)

    // The mail's `ENROLMENT_LINK` placeholder comes from the same module setting as this field, so
    // a link here is a link in the message; a bare "enrol in Sisu" would leave the student stuck.
    const mine = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_B_COURSE_SLUG)
    expect(mine.enrolment_link).toBe(CRS_B_101_ENROLMENT_LINK)

    await runStudentNotificationsTick(page.request, scope)
    const afterSecond = await adminRegistrationDetails(adminApi, parked.id)
    expect(mailIdentities(afterSecond.notification_emails)).toStrictEqual(
      mailIdentities(queued.notification_emails),
    )
  })
})
