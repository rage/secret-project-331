import { test } from "@playwright/test"

import { showNextToastsInfinitely, showToastsNormally } from "../../utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Success notifications work", async ({ page, headless }, testInfo) => {
  await page.goto(
    "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/pages",
  )

  await page
    .getByRole("row", { name: /In the second chapter\.\.\./ })
    .getByRole("button", { name: "Edit page" })
    .click()
  await page.fill('input[label="Title"]', "New title")

  await showNextToastsInfinitely(page)
  await page.click(`button:text-is("Save") >> visible=true`)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "success-notification-test",
    waitForTheseToBeVisibleAndStable: [page.getByText("Success").first().first()],
    dontWaitForSpinnersToDisappear: true,
  })
  await showToastsNormally(page)
})
