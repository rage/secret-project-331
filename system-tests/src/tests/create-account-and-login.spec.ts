import { expect, test } from "@playwright/test"

import { Topbar } from "../utils/components/Topbar"

test("User can create an account and log in", async ({ page }) => {
  await test.step("User can create an account", async () => {
    await page.goto("http://project-331.local/signup?return_to=%2F")

    await page.getByRole("textbox", { name: "First name (Required)" }).fill("Test")
    await page.getByRole("textbox", { name: "Last name (Required)" }).fill("User")
    await page.getByRole("button", { name: "Select an item Where do you" }).click()
    await page.getByLabel("Where do you live?").getByText("Andorra").click()
    await page.getByRole("textbox", { name: "Email (Required)" }).fill("testuser@example.com")
    await page.getByRole("textbox", { name: "Password (Required)", exact: true }).fill("testuser")
    await page.getByRole("textbox", { name: "Confirm password (Required)" }).fill("testuser")

    await page.getByRole("button", { name: "Create an account" }).click()

    await expect(page.getByRole("heading", { name: "Regarding research done on" })).toBeVisible()
    await page.getByText("I do not want to participate").click()
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByRole("heading", { name: "Please confirm your email" })).toBeVisible()
    await page.getByRole("button", { name: "Done" }).click()
    const topbar = new Topbar(page)
    await topbar.quickActions.clickItem("Log out")
  })

  await test.step("User can log in with the created account", async () => {
    await page.getByRole("textbox", { name: "Email (Required)" }).fill("testuser@example.com")
    await page.getByRole("textbox", { name: "Password (Required)" }).fill("testuser")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible()
  })
})
