import { test } from "@playwright/test"

import { showNextToastsInfinitely, showToastsNormally } from "../../utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("Error notifications work", async ({ page, headless }, testInfo) => {
  await page.goto(
    "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/pages",
  )

  await page.click(`button:text("Edit page"):right-of(:text("In the second chapter..."))`)

  await page.locator("text=Add task").click()

  await page.click(`button:text-is("Save") >> visible=true`)
  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })
  await showNextToastsInfinitely(page)
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "error-notification-test",
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("heading", { name: "Error 400: Bad Request" }),
    ],
    clearNotifications: true,
  })
  await showToastsNormally(page)
})
