import { test, expect } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Can mark page as read", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()
  await page
    .getByRole("link", { name: "Select University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Introduction to Course Material", exact: true }).click()
  await selectCourseInstanceIfPrompted(page)

  await page.getByTestId("chapter-link-1").click()
  await page.getByTestId("page-in-chapter-link-1").click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Mark the page as read" }).click()
  })
  await expect(page.getByRole("button", { name: "Mark the page as unread" })).toBeVisible
})
