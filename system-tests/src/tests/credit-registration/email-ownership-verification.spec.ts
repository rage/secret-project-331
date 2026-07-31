import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { AccountTab } from "@/utils/components/UserSettings/AccountTab"
import { signUp } from "@/utils/flows/signup.flow"

/**
 * A verification mail is queued, opening its link records the proof, changing the address clears the
 * proof, and a spent link is refused with its own copy.
 *
 * The compromise: there is no mail capture anywhere in this repo, so the spec cannot read the link out
 * of an inbox. It asks the backend for the caller's own pending link through
 * `GET /email-verification/test-mode-link`, which 404s unless `TEST_MODE` is on and only ever returns
 * the signed-in account's own link. The link's host comes from `FRONTEND_BASE_URL`, which the dev
 * cluster does not set, so only the token is taken from it and the URL is rebuilt against
 * project-331.local.
 *
 * The account is created by the spec rather than seeded, because the spec changes its email address and
 * a seeded user's address is a login credential other specs depend on.
 */

const ACCOUNT_URL = "http://project-331.local/user-settings/account"
const TEST_MODE_LINK_URL =
  "http://project-331.local/api/v0/main-frontend/email-verification/test-mode-link"

const FIRST_EMAIL = "email-ownership@example.com"
const SECOND_EMAIL = "email-ownership-moved@example.com"
const PASSWORD = "email-ownership"

async function pendingVerificationToken(page: Page): Promise<string> {
  const response = await page.request.get(TEST_MODE_LINK_URL)
  expect(response.ok()).toBe(true)
  const link: string = await response.json()
  const token = new URL(link).searchParams.get("token")
  expect(token).not.toBeNull()
  return token as string
}

async function openVerificationLink(page: Page, token: string): Promise<void> {
  await page.goto(`http://project-331.local/email-verified?token=${token}`)
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

  let spentToken = ""

  await test.step("Opening the link records the proof", async () => {
    spentToken = await pendingVerificationToken(page)
    await openVerificationLink(page, spentToken)
    await expect(page.getByTestId("email-verification-outcome")).toContainText(
      "Your email has been verified",
    )

    await page.goto(ACCOUNT_URL)
    const section = page.getByTestId("email-verification-section")
    await expect(section.getByText("Email verified", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Send a new verification link" })).toBeHidden()
  })

  await test.step("Reopening the spent link is refused with its own copy", async () => {
    await openVerificationLink(page, spentToken)
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
    const token = await pendingVerificationToken(page)
    await openVerificationLink(page, token)
    await expect(page.getByTestId("email-verification-outcome")).toContainText(
      "Your email has been verified",
    )

    await page.goto(ACCOUNT_URL)
    await expect(
      page.getByTestId("email-verification-section").getByText("Email verified", { exact: true }),
    ).toBeVisible()
  })
})
