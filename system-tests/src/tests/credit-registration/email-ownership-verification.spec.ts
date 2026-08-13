import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { AccountTab } from "@/utils/components/UserSettings/AccountTab"
import { ORIGIN } from "@/utils/creditRegistration"
import { signUp } from "@/utils/flows/signup.flow"

/**
 * No mail capture exists in this repo, so the code comes from
 * `GET /email-verification/test-mode-code`, which 404s unless `TEST_MODE` is on and only ever
 * returns the signed-in account's own code.
 *
 * The account is created rather than seeded because this spec changes its email address,
 * and a seeded user's address is a login credential other specs depend on.
 */

const ACCOUNT_URL = `${ORIGIN}/user-settings/account`
const TEST_MODE_CODE_URL = `${ORIGIN}/api/v0/main-frontend/email-verification/test-mode-code`
const VERIFY_URL = `${ORIGIN}/api/v0/main-frontend/email-verification/verify`

const FIRST_EMAIL = "email-ownership@example.com"
const SECOND_EMAIL = "email-ownership-moved@example.com"
const PASSWORD = "email-ownership"

async function pendingVerificationCode(page: Page): Promise<string> {
  const response = await page.request.get(TEST_MODE_CODE_URL)
  await expect(response).toBeOK()
  const code: string = await response.json()
  expect(code).toMatch(/^[0-9]{6}$/)
  return code
}

/** Digit-rotated so it is always a valid-shaped code and never the real one. */
function wrongCode(code: string): string {
  return Array.from(code, (digit) => String((Number(digit) + 1) % 10)).join("")
}

/**
 * Clears the field before typing: after a refused attempt every slot still holds a digit, and each
 * slot takes one character only. Backspace walks backwards from the last slot.
 */
async function enterCode(page: Page, code: string): Promise<void> {
  const slots = page.getByTestId("one-time-code-field").getByRole("textbox")
  const slotCount = await slots.count()
  await slots.nth(slotCount - 1).click()
  for (let index = 0; index < slotCount; index++) {
    await page.keyboard.press("Backspace")
  }
  await slots.first().click()
  await page.keyboard.type(code)
}

test("Email ownership verification: the emailed code proves the address and an email change clears the proof", async ({
  page,
}) => {
  test.slow()
  const accountTab = new AccountTab(page)

  await test.step("Signing up queues a verification code and the address starts unverified", async () => {
    await signUp(page, {
      firstName: "Email",
      lastName: "Ownership",
      email: FIRST_EMAIL,
      password: PASSWORD,
    })

    await page.goto(ACCOUNT_URL)
    const section = page.getByTestId("email-verification-section")
    await expect(section.getByText("Email not verified")).toBeVisible()
    await expect(section.getByText(FIRST_EMAIL, { exact: true }).first()).toBeVisible()
    await expect(section.getByText("Code sent")).toBeVisible()
  })

  await test.step("Opening the code dialog and asking for another code right away is refused by the resend cap", async () => {
    await page.getByRole("button", { name: "Enter verification code" }).click()
    await page.getByRole("button", { name: "Resend" }).click()
    await expect(page.getByTestId("email-verification-request-outcome")).toContainText(
      "went to your email address a moment ago",
    )
  })

  let spentCode = ""

  await test.step("A wrong code is refused, and the emailed one verifies the address", async () => {
    spentCode = await pendingVerificationCode(page)

    await enterCode(page, wrongCode(spentCode))
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.locator("#code-error")).toContainText("Incorrect code")

    await enterCode(page, spentCode)
    await page.getByRole("button", { name: "Verify" }).click()

    const section = page.getByTestId("email-verification-section")
    await expect(section.getByText("Email verified", { exact: true })).toBeVisible()
    await expect(page.getByTestId("one-time-code-field")).toBeHidden()
  })

  await test.step("The spent code cannot be submitted again", async () => {
    const response = await page.request.post(VERIFY_URL, { data: { code: spentCode } })
    await expect(response).toBeOK()
    expect(await response.json()).toBe("already_verified")
  })

  await test.step("Changing the email address clears the proof and mails a new code, without a reload", async () => {
    await page.goto(ACCOUNT_URL)
    await accountTab.waitForTab()
    await accountTab.updatePersonalInformation(
      { email: SECOND_EMAIL },
      { field: "email", expectedValue: SECOND_EMAIL },
    )

    const section = page.getByTestId("email-verification-section")
    await expect(section.getByText("Email not verified")).toBeVisible()
    await expect(section.getByText(SECOND_EMAIL, { exact: true }).first()).toBeVisible()
    await page.getByRole("button", { name: "Enter verification code" }).click()
    await expect(page.getByTestId("one-time-code-field")).toBeVisible()
  })

  await test.step("The code for the new address verifies it again", async () => {
    const newCode = await pendingVerificationCode(page)
    expect(newCode).not.toBe(spentCode)

    await enterCode(page, newCode)
    await page.getByRole("button", { name: "Verify" }).click()

    await expect(
      page.getByTestId("email-verification-section").getByText("Email verified", { exact: true }),
    ).toBeVisible()
  })
})
