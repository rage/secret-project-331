import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { AccountTab } from "@/utils/components/UserSettings/AccountTab"
import { signUp } from "@/utils/flows/signup.flow"

/**
 * No mail capture exists in this repo, so the link comes from
 * `GET /email-verification/test-mode-link`, which 404s unless `TEST_MODE` is on and only
 * ever returns the signed-in account's own link.
 *
 * The account is created rather than seeded because this spec changes its email address,
 * and a seeded user's address is a login credential other specs depend on.
 */

const ORIGIN = "http://project-331.local"
const ACCOUNT_URL = `${ORIGIN}/user-settings/account`
const TEST_MODE_LINK_URL = `${ORIGIN}/api/v0/main-frontend/email-verification/test-mode-link`

const FIRST_EMAIL = "email-ownership@example.com"
const SECOND_EMAIL = "email-ownership-moved@example.com"
const PASSWORD = "email-ownership"

async function pendingVerificationLink(page: Page): Promise<string> {
  const response = await page.request.get(TEST_MODE_LINK_URL)
  expect(response.ok()).toBe(true)
  const link: string = await response.json()
  // Not /email-verified: that path stays tmc.mooc.fi's own redirect target.
  expect(link).toContain(`${ORIGIN}/verify-email?token=`)
  return link
}

test("Email ownership verification: the mailed link proves the address and an email change clears the proof", async ({
  page,
}) => {
  test.slow()
  const accountTab = new AccountTab(page)

  await test.step("Signing up queues a verification link and the address starts unverified", async () => {
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
    await expect(section.getByText("Link sent to")).toBeVisible()
  })

  await test.step("Asking for another link right away is refused by the resend cap", async () => {
    await page.getByRole("button", { name: "Send a new verification link" }).click()
    await expect(page.getByTestId("email-verification-request-outcome")).toContainText(
      "went to your email address a moment ago",
    )
  })

  let spentLink = ""

  await test.step("Opening the link records the proof", async () => {
    spentLink = await pendingVerificationLink(page)
    await page.goto(spentLink)
    await expect(page.getByTestId("email-verification-outcome")).toContainText(
      "Your email has been verified",
    )

    await page.goto(ACCOUNT_URL)
    const section = page.getByTestId("email-verification-section")
    await expect(section.getByText("Email verified", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Send a new verification link" })).toBeHidden()
  })

  await test.step("Reopening the spent link is refused with its own copy", async () => {
    await page.goto(spentLink)
    await expect(page.getByTestId("email-verification-outcome")).toContainText(
      "This link has already been used",
    )
  })

  await test.step("Changing the email address clears the proof and mails a link to the new address, without a reload", async () => {
    await page.goto(ACCOUNT_URL)
    await accountTab.waitForTab()
    await accountTab.updatePersonalInformation(
      { email: SECOND_EMAIL },
      { field: "email", expectedValue: SECOND_EMAIL },
    )

    const section = page.getByTestId("email-verification-section")
    await expect(section.getByText("Email not verified")).toBeVisible()
    await expect(section.getByText(SECOND_EMAIL, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Send a new verification link" })).toBeVisible()
  })

  await test.step("The link for the new address verifies it again", async () => {
    await page.goto(await pendingVerificationLink(page))
    await expect(page.getByTestId("email-verification-outcome")).toContainText(
      "Your email has been verified",
    )

    await page.goto(ACCOUNT_URL)
    await expect(
      page.getByTestId("email-verification-section").getByText("Email verified", { exact: true }),
    ).toBeVisible()
  })
})
