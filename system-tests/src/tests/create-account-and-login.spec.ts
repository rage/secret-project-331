import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"

import { logoutViaTopbar } from "../utils/flows/topbar.flow"

test("User can create an account and log in", async ({ page }) => {
  await test.step("User can create an account", async () => {
    await page.goto("http://project-331.local/signup?return_to=%2F")

    await page.getByRole("textbox", { name: "First name" }).fill("Test")
    await page.getByRole("textbox", { name: "Last name" }).fill("User")
    await page.getByRole("button", { name: "Select an item Where do you" }).click()
    await page.getByLabel("Where do you live?").getByText("Andorra").click()
    await page.getByRole("textbox", { name: "Email" }).fill("testuser@example.com")
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("testuser")
    await page.getByRole("textbox", { name: "Confirm password" }).fill("testuser")

    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Create an account" }).click()
    })

    await expect(page.getByRole("heading", { name: "Regarding research done on" })).toBeVisible()
    await page.getByText("I do not want to participate").click()
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save" }).click()
    })

    await expect(page.getByRole("heading", { name: "Please confirm your email" })).toBeVisible()
    await page.getByRole("button", { name: "Done" }).click()
    await logoutViaTopbar(page)
  })

  await test.step("User can log in with the created account", async () => {
    await page.getByRole("heading", { name: "Log in" }).waitFor()
    await page.getByRole("textbox", { name: "Email *" }).fill("testuser@example.com")
    await page.getByRole("textbox", { name: "Password *", exact: true }).fill("testuser")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible()
  })
})
