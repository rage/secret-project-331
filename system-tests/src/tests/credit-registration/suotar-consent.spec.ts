import {
  countMockCallsForStudent,
  PROFILE_CREDIT_REGISTRATION_URL,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import { respondToConfirmDialog } from "@/utils/dialogs"
import { expect, test } from "@/utils/fixtures"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import {
  runPhasesUpToSubmission,
  runPreconditionsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"

/** Owns student numbers `9000007xx`. */
const WITHHELD_EMAIL = "credit-registration-consent-withheld@example.com"
const WITHHELD_STUDENT_NUMBER = "900000701"
const WITHDRAWN_EMAIL = "credit-registration-consent-withdrawn@example.com"
const WITHDRAWN_STUDENT_NUMBER = "900000702"

/**
 * The endpoints that carry one student's registration. `list-by-course` and `product_access_tokens`
 * are left out because they are keyed by course and product alone, so a call to either says nothing
 * about whether we acted on this student.
 */
const REGISTRATION_ENDPOINTS = [
  "resolve_persons",
  "resolve_enrolments",
  "import_attainments",
  "verify_attainments",
] as const

test.describe("A student nobody has asked yet", () => {
  test.use({ storageState: seededStudentStorageState(WITHHELD_EMAIL) })

  test("Withholding consent submits nothing", async ({ page, adminApi }) => {
    const scope = { userEmail: WITHHELD_EMAIL }

    await runPhasesUpToSubmission(page.request, scope)
    await runVerifyPollTick(page.request, scope)

    const row = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "pending_consent",
    ])
    expect(row.student_facing_status).toBe("needs_consent")

    for (const endpoint of REGISTRATION_ENDPOINTS) {
      expect(
        await countMockCallsForStudent(page.request, WITHHELD_STUDENT_NUMBER, endpoint),
        `${endpoint} was called for a student who never consented`,
      ).toBe(0)
    }
  })
})

test.describe("A student who consented and then changed their mind", () => {
  test.use({ storageState: seededStudentStorageState(WITHDRAWN_EMAIL) })

  test("Withdrawing consent mid-flight abandons the row and stops polling", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: WITHDRAWN_EMAIL }

    await runPhasesUpToSubmission(page.request, scope)
    await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "awaiting_verification",
    ])

    await test.step("The student withdraws from their profile", async () => {
      await page.goto(PROFILE_CREDIT_REGISTRATION_URL)
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Withdraw" }).first().click()
        await respondToConfirmDialog(page, true)
      })
    })

    await runPreconditionsTick(page.request, scope)
    const abandoned = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "abandoned_by_consent_withdrawal",
    ])
    // Neither a success nor a failure: the request is already out of our hands, so we cannot honestly
    // say whether the University recorded it.
    expect(abandoned.student_facing_status).toBe("not_registering")

    await test.step("Polling stops", async () => {
      const before = await countMockCallsForStudent(
        page.request,
        WITHDRAWN_STUDENT_NUMBER,
        "verify_attainments",
      )
      await runVerifyPollTick(page.request, scope)
      await runVerifyPollTick(page.request, scope)
      expect(
        await countMockCallsForStudent(
          page.request,
          WITHDRAWN_STUDENT_NUMBER,
          "verify_attainments",
        ),
      ).toBe(before)
    })

    await test.step("It is in no failure or stuck count", async () => {
      const byState = await listAdminRegistrations(adminApi, {
        student_number: WITHDRAWN_STUDENT_NUMBER,
        state: "abandoned_by_consent_withdrawal",
      })
      expect(byState.total_count).toBe(1)

      const needingAHuman = await listAdminRegistrations(adminApi, {
        student_number: WITHDRAWN_STUDENT_NUMBER,
        needs_admin_attention: true,
      })
      expect(needingAHuman.total_count).toBe(0)
    })
  })
})
