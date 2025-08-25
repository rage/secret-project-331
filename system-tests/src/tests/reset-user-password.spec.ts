import { expect, test } from "@playwright/test"

test("Can change users password with reset passwors token", async ({ page }) => {
  // Go to reset password page
  await page.goto(
    "http://project-331.local/reset-user-password/5a831370-6b7e-4ece-b962-6bc31c28fe53",
  )
  // Submit new password
  await page.getByRole("textbox", { name: "Password (Required)", exact: true }).fill("new-password")
  await page.getByRole("textbox", { name: "Confirm password (Required)" }).fill("new-password")
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("Success", { exact: true })).toBeVisible()

  // Go to reset password page again to check the has expired
  await page.goto(
    "http://project-331.local/reset-user-password/5a831370-6b7e-4ece-b962-6bc31c28fe53",
  )
  await expect(page.getByText("Password reset link has expired")).toBeVisible()

  // Log in with new password to verify that the password change was successful
  await page.goto("http://project-331.local/login")
  await page.getByRole("textbox", { name: "Email (Required)" }).fill("sign-up-user@example.com")
  await page.getByRole("textbox", { name: "Password (Required)" }).fill("new-password")
  await page.getByRole("button", { name: "Log in" }).click()

  await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible()
})
