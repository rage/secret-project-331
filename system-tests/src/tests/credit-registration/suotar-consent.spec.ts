import { expect, test } from "@playwright/test"

import {
  countMockCallsForStudent,
  CREDIT_REGISTRATION_ADMIN_API,
  loginAsSeededStudent,
  PROFILE_CREDIT_REGISTRATION_URL,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { respondToConfirmDialog } from "@/utils/dialogs"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"

/** Owns student numbers `9000007xx`. */
const WITHHELD_EMAIL = "credit-registration-consent-withheld@example.com"
const WITHHELD_STUDENT_NUMBER = "900000701"
const WITHDRAWN_EMAIL = "credit-registration-consent-withdrawn@example.com"
const WITHDRAWN_STUDENT_NUMBER = "900000702"
const ADMIN_STORAGE_STATE = "src/states/admin@example.com.json"

/**
 * The endpoints that carry one student's registration. `list-by-course` and `product_access_tokens`
 * are left out on purpose: both are keyed by course/product only (`ListByCourseItem` and
 * `ProductAccessTokenItem` carry no `studentNumber`), so a call to either says nothing about whether
 * we acted on this student.
 */
const REGISTRATION_ENDPOINTS = [
  "resolve_persons",
  "resolve_enrolments",
  "import_attainments",
  "verify_attainments",
] as const

test("Withholding consent submits nothing", async ({ page }) => {
  await loginAsSeededStudent(page, WITHHELD_EMAIL)
  const scope = { userEmail: WITHHELD_EMAIL }

  await runMaterializeTick(page.request, scope)
  await runPreconditionsTick(page.request, scope)
  await runResolveEnrolmentsTick(page.request, scope)
  await runImportSubmissionTick(page.request, scope)
  await runVerifyPollTick(page.request, scope)

  const row = await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, ["pending_consent"])
  expect(row.student_facing_status).toBe("needs_consent")

  for (const endpoint of REGISTRATION_ENDPOINTS) {
    expect(
      await countMockCallsForStudent(page.request, WITHHELD_STUDENT_NUMBER, endpoint),
      `${endpoint} was called for a student who never consented`,
    ).toBe(0)
  }
})

test("Withdrawing consent mid-flight abandons the row and stops polling", async ({
  browser,
  page,
}) => {
  await loginAsSeededStudent(page, WITHDRAWN_EMAIL)
  const scope = { userEmail: WITHDRAWN_EMAIL }

  await runMaterializeTick(page.request, scope)
  await runPreconditionsTick(page.request, scope)
  await runResolveEnrolmentsTick(page.request, scope)
  await runImportSubmissionTick(page.request, scope)
  await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, ["awaiting_verification"])

  await test.step("The student withdraws from their profile", async () => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)
    await page.getByRole("button", { name: "Withdraw" }).first().click()
    await respondToConfirmDialog(page, true)
  })

  await runPreconditionsTick(page.request, scope)
  const abandoned = await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, [
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
      await countMockCallsForStudent(page.request, WITHDRAWN_STUDENT_NUMBER, "verify_attainments"),
    ).toBe(before)
  })

  await test.step("It is in no failure or stuck count", async () => {
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
    try {
      const byState = await context.request.get(
        `${CREDIT_REGISTRATION_ADMIN_API}/registrations?student_number=${WITHDRAWN_STUDENT_NUMBER}&state=abandoned_by_consent_withdrawal`,
      )
      expect(byState.ok()).toBe(true)
      expect(await byState.json()).toMatchObject({ total_count: 1 })

      const needingAHuman = await context.request.get(
        `${CREDIT_REGISTRATION_ADMIN_API}/registrations?student_number=${WITHDRAWN_STUDENT_NUMBER}&needs_admin_attention=true`,
      )
      expect(needingAHuman.ok()).toBe(true)
      expect(await needingAHuman.json()).toMatchObject({ total_count: 0 })
    } finally {
      await context.close()
    }
  })
})
