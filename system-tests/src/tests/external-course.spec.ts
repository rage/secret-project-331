import { test, expect } from "@playwright/test"

import { respondToConfirmDialog, submitDialog } from "@/utils/dialogs"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("can-create-new-external-course", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "External courses" }).click()
  await page.getByRole("button", { name: "Create", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "New course" })
  await dialog.getByRole("textbox", { name: "Name" }).fill("test course")
  await dialog.getByRole("textbox", { name: "Description" }).fill("external course")
  await dialog.getByRole("textbox", { name: "Url" }).fill("http://mooc.fi")
  await dialog.getByLabel("Is the course hosted on the old version of the mooc.fi platform").click()
  await waitForSuccessNotification(page, async () => {
    await submitDialog(dialog, "Create")
  })
  await expect(page.getByRole("heading", { name: "test course" })).toBeVisible()
})

test("can-edit-external-course", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "External courses" }).click()
  await page.getByRole("button", { name: "Edit" }).click()
  await page.getByRole("textbox", { name: "Name" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("new name")
  await page.getByRole("textbox", { name: "Description" }).click()
  await page.getByRole("textbox", { name: "Description" }).fill("new desc")
  await page.getByRole("textbox", { name: "Url" }).click()
  await page.getByRole("textbox", { name: "Url" }).fill("new.fi")
  await waitForSuccessNotification(
    page,
    async () => {
      await page.getByRole("button", { name: "Save" }).click()
    },
    "Course edited successfully",
  )
  await expect(page.getByRole("heading", { name: "new name" })).toBeVisible()
  await expect(page.getByText("new desc")).toBeVisible()
  await expect(page.getByText("new.fi")).toBeVisible()
})

test("can-delete-external-course", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "External courses" }).click()
  await waitForSuccessNotification(
    page,
    async () => {
      await page.getByRole("button", { name: "Delete" }).click()
      await respondToConfirmDialog(page, true, "Are you sure you want to delete this course?")
    },
    "Course deleted successfully",
  )

  await expect(page.getByText("No external courses found")).toBeVisible()
})
