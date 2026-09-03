import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const replaceTimeComponentDates = async (page: Page) => {
  await page.evaluate(() => {
    const components = document.querySelectorAll(".time-component-date")
    for (const comp of Array.from(components)) {
      comp.innerHTML = "yyyy-MM-dd HH:mm"
    }
  })
}

test("can add and delete exercise service", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local")
  await page.evaluate(() => {
    window.scrollTo(0, 700)
  })

  await page.getByText("Manage exercise services").click()
  await expect(page).toHaveURL("http://project-331.local/manage/exercise-services")

  await expectUrlPathWithRandomUuid(page, "/manage/exercise-services")

  await page.getByRole("button", { name: "New", exact: true }).click()

  const creationDialog = page.getByRole("dialog", { name: "Create" })
  await creationDialog.getByLabel("Name", { exact: true }).fill("New exercise service")
  await creationDialog.getByLabel("Public URL", { exact: true }).fill("http://example.com")
  await creationDialog.getByLabel("Internal URL", { exact: true }).click()

  await creationDialog.getByRole("button", { name: "Create", exact: true }).click()
  await page.getByText("New exercise service").waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "exercise-service-page",
    waitForTheseToBeVisibleAndStable: [page.getByText("New exercise service")],

    beforeScreenshot: async () => {
      await replaceTimeComponentDates(page)
    },
    clearNotifications: true,
  })

  await page.getByTestId("exercise-service-card-new-exercise-service").getByLabel("Delete").click()
  // confirm
  await page.getByRole("button").getByText("Delete").click()
  for (const locator of await page.getByText("New exercise service").all()) {
    await expect(locator).toBeHidden()
  }
})
