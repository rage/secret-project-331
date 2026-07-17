import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { respondToConfirmDialog } from "@/utils/dialogs"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

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
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save" }).click()
    })
    await expect(page.getByText("Advanced settings")).toBeVisible()
    await page.getByRole("textbox", { name: "Prompt" }).fill("Chatbot 1 prompt")
    await page.getByRole("textbox", { name: "Initial message" }).fill("Chatbot 1 initial message")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click()
    })
  })

  test("Editing a chatbot", async ({ page }) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Chatbot 1 Edit" })
      .getByRole("button", { name: "Edit" })
      .click()
    await page.getByRole("textbox", { name: "Name" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("Chatbot 2")
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click()
    })
    await page.getByText("Advanced settings").waitFor()

    await page.getByRole("textbox", { name: "Prompt" }).click()
    await page.getByRole("textbox", { name: "Prompt" }).fill("Hello")
    await page.getByRole("textbox", { name: "Initial message" }).click()
    await page.getByRole("textbox", { name: "Initial message" }).fill("Hi! :)")
    await page.getByRole("checkbox", { name: "Enabled to students" }).click()
    await page.getByRole("heading", { name: "Advanced settings" }).click()
    await page.getByRole("spinbutton", { name: "Frequency penalty" }).click()
    await page.getByRole("spinbutton", { name: "Frequency penalty" }).fill("0.2")
    await page
      .getByRole("checkbox", { name: "Use course material search and cite sources" })
      .click()
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click()
    })
  })

  test("Setting a chatbot as default", async ({ page }) => {
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Set as the default chatbot" }).first().click()
    })
    await expect(page.getByText("(Default)")).toBeVisible()
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Set as the default chatbot" }).first().click()
    })
  })

  test("Teacher uses chatbot preview after creating chatbot", async ({ page }) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Chatbot 2 Edit" })
      .getByRole("button", { name: "Edit" })
      .click()
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save and preview chatbot", exact: true }).click()
    })

    await test.step("agree to terms", async () => {
      await expect(page.getByText("About the chatbot")).toBeVisible()
      await page.getByRole("button", { name: "Agree" }).click()
      await expect(page.getByText("Chatbots can make mistakes.")).toBeVisible()
    })

    await test.step("send message", async () => {
      await page.getByPlaceholder("Message").click()
      await page.getByPlaceholder("Message").fill("Hello, pls help me!")
      await page.getByRole("button", { name: "Send" }).click()
      await page.getByText("Hello! How can I assist you today?").waitFor()
    })
  })

  test("Teacher uses chatbot preview after editing existing chatbot", async ({ page }) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Chatbot 2 Edit" })
      .getByRole("button", { name: "Edit" })
      .click()
    await page.getByRole("textbox", { name: "Name" }).click()
    await page.getByRole("textbox", { name: "Name" }).fill("Chatbot 2 edited")

    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Save and preview chatbot", exact: true }).click()
    })

    await test.step("send message", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Chatbot 2 edited" })).toBeVisible()

      await page.getByPlaceholder("Message").click()
      await page.getByPlaceholder("Message").fill("Hello, pls help me!")
      // The preview mounts its conversation asynchronously; wait for Send to become enabled (canSubmit)
      // so we don't click while the preview is still settling.
      await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 15000 })
      await page.getByRole("button", { name: "Send" }).click()
      await page.getByText("Hello! How can I assist you today?").waitFor()
    })
  })

  test("Deleting a chatbot", async ({ page }) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Chatbot 2 Edit" })
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
