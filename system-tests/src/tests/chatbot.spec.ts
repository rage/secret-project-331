import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { respondToConfirmDialog } from "@/utils/dialogs"

test.describe("Chatbot settings testing", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(
      "http://project-331.local/manage/courses/c7753361-5b78-4307-aad6-f139ea3865d4/other",
    )
    await page.getByRole("tab", { name: "Chatbots" }).click()
    await page.getByText("Customize chatbot").waitFor()
  })

  test("Creating a chatbot", async ({ page }) => {
    await page.getByRole("button", { name: "Create a new chatbot" }).click()
    await page.getByRole("textbox", { name: "Name" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("Chatbot 1")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Operation successful!")).toBeVisible()
    await expect(page.getByText("Advanced settings")).toBeVisible()
  })

  test("Editing a chatbot", async ({ page }) => {
    await page.getByRole("button", { name: "Edit" }).first().click()
    await page.getByRole("textbox", { name: "Name" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("Chatbot 1")
    await page.getByRole("button", { name: "Save" }).click()
    await page.getByText("Advanced settings").waitFor()

    await page.getByRole("textbox", { name: "Prompt" }).click()
    await page.getByRole("textbox", { name: "Prompt" }).fill("Hello")
    await page.getByRole("textbox", { name: "Initial message" }).click()
    await page.getByRole("textbox", { name: "Initial message" }).fill("Hi! :)")
    await page.getByText("Enabled to students").click()
    await page.getByRole("heading", { name: "Advanced settings" }).click()
    await page.getByRole("spinbutton", { name: "Frequency penalty" }).click()
    await page.getByRole("spinbutton", { name: "Frequency penalty" }).fill("0.2")
    await page.getByText("Use Azure search").click()
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Operation successful!")).toBeVisible()
  })

  test("Setting a chatbot as default", async ({ page }) => {
    await page.getByRole("button", { name: "Set as the default chatbot" }).first().click()
    await expect(page.getByText("Operation successful!")).toBeVisible()
    await expect(page.getByText("(Default)")).toBeVisible()
    await page.getByRole("button", { name: "Set as the default chatbot" }).first().click()
    await expect(page.getByText("Operation successful!")).toBeVisible()
  })

  test("Deleting a chatbot", async ({ page }) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Chatbot 1 Edit" })
      .getByRole("button", { name: "Edit" })
      .click()
    await page.getByText("Advanced settings").waitFor()
    await page.getByRole("button", { name: "Delete" }).click()
    await respondToConfirmDialog(page, true)
    await expect(page.getByText("Deleted", { exact: true })).toBeVisible()
  })

  test("Accessibility check", async ({ page }) => {
    await accessibilityCheck(page, "Manage course page chatbots tab / View", [])
    await page.getByRole("button", { name: "Edit" }).first().click()
    await accessibilityCheck(page, "Chatbot settings / Edit", [])
  })
})
