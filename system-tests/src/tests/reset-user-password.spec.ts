import { expect, test } from "@playwright/test"

import { showNextToastsInfinitely, showToastsNormally } from "@/utils/notificationUtils"

test("Can change user's password with reset password token", async ({ page }) => {
  // Go to reset password page
  await page.goto(
    "http://project-331.local/reset-user-password/5a831370-6b7e-4ece-b962-6bc31c28fe53",
  )
  await showNextToastsInfinitely(page)

  // Submit new password
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("new-password")
  await page.getByRole("textbox", { name: "Confirm new password" }).fill("new-password")
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(page.getByText("Success", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible()

  // Go to reset password page again to check the has expired
  await page.goto(
    "http://project-331.local/reset-user-password/5a831370-6b7e-4ece-b962-6bc31c28fe53",
  )
  await expect(page.getByRole("heading", { name: "This link no longer works" })).toBeVisible()

  // Log in with new password to verify that the password change was successful
  await page.goto("http://project-331.local/login")
  await page.getByRole("textbox", { name: "Email" }).fill("sign-up-user@example.com")
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("new-password")
  await page.getByRole("button", { name: "Log in" }).click()

  await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible()
  await showToastsNormally(page)
})
