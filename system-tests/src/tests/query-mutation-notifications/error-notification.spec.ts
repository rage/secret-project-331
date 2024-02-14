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

  await page.getByText("Add task").click()
  await showNextToastsInfinitely(page)
  await page.click(`button:text-is("Save") >> visible=true`)
  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })
  await page.getByText("An error occurred").waitFor()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "error-notification-test",
    clearNotifications: true,
  })
  await showToastsNormally(page)
})
