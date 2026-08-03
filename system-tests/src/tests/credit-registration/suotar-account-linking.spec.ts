import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  CREDIT_REGISTRATIONS_API,
  linkStudentNumberUrl,
  loginAsSeededStudent,
} from "@/utils/creditRegistration"

/**
 * Owns student numbers `9000002xx` and the four fixed tokens the seed writes rather than mails.
 *
 * Serial and order-dependent: the first test links `900000201` to the claiming account, which is
 * what makes the conflict case below a conflict.
 */
const CLAIMER_EMAIL = "credit-registration-link-claimer@example.com"

const repeated = (uuid: string) => uuid.repeat(4)
const TOKEN_VALID = repeated("11111111-1111-1111-1111-111111111111")
const TOKEN_EXPIRED = repeated("22222222-2222-2222-2222-222222222222")
const TOKEN_ALREADY_USED = repeated("33333333-3333-3333-3333-333333333333")
const TOKEN_CONFLICT = repeated("44444444-4444-4444-4444-444444444444")

const EXPIRED_COPY = "This link has expired."
const ALREADY_USED_COPY = "This link has already been used."
const CONFLICT_COPY = "This student number is already linked to a different account."

test.describe.configure({ mode: "serial" })

test("A preview consumes nothing, and confirming links the number to the logged-in account", async ({
  page,
}) => {
  await loginAsSeededStudent(page, CLAIMER_EMAIL)
  await page.goto(linkStudentNumberUrl(TOKEN_VALID))

  const confirm = page.getByTestId("link-student-number-confirm-button")
  await expect(confirm).toBeVisible()
  // The three facts the confirmation page exists to show: the token carries no account, so this
  // display is the only thing standing between a forwarded email and the wrong account.
  await expect(page.getByText("900000201")).toBeVisible()
  await expect(page.getByText("Zzyzx Linkvalid")).toBeVisible()
  await expect(page.getByText(CLAIMER_EMAIL)).toBeVisible()
  await accessibilityCheck(page, "Student number linking confirmation", [])

  // A mail scanner following the link must not spend the token, so only the POST may claim it.
  await page.reload()
  await expect(page.getByTestId("link-student-number-confirm-button")).toBeVisible()

  await page.getByTestId("link-student-number-confirm-button").click()
  await expect(page.getByText("Student number linked")).toBeVisible()

  const response = await page.request.get(`${CREDIT_REGISTRATIONS_API}/my/student-number`)
  expect(response.ok()).toBe(true)
  expect(await response.json()).toMatchObject({
    student_number: "900000201",
    verified_via: "emailed_link",
  })
})

test("An expired link and an already-used link say different things", async ({ page }) => {
  await loginAsSeededStudent(page, CLAIMER_EMAIL)

  await page.goto(linkStudentNumberUrl(TOKEN_EXPIRED))
  await expect(page.getByText(EXPIRED_COPY)).toBeVisible()
  await expect(page.getByTestId("link-student-number-confirm-button")).toHaveCount(0)

  await page.goto(linkStudentNumberUrl(TOKEN_ALREADY_USED))
  await expect(page.getByText(ALREADY_USED_COPY)).toBeVisible()
  await expect(page.getByText(EXPIRED_COPY)).toHaveCount(0)
})

test("A number already live on another account is refused, and the token survives", async ({
  page,
}) => {
  await loginAsSeededStudent(page, CLAIMER_EMAIL)

  await page.goto(linkStudentNumberUrl(TOKEN_CONFLICT))
  await expect(page.getByText(CONFLICT_COPY)).toBeVisible()
  await expect(page.getByTestId("link-student-number-confirm-button")).toHaveCount(0)

  // Retry-able once support has unlinked the other account, so the refusal must not have spent it.
  const preview = await page.request.get(
    `${CREDIT_REGISTRATIONS_API}/student-number-verifications/${TOKEN_CONFLICT}`,
  )
  expect(preview.ok()).toBe(true)
  expect(await preview.json()).toMatchObject({
    already_used: false,
    conflicts_with_other_account: true,
  })
})
