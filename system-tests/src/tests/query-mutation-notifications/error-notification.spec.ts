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

  await page
    .getByRole("row", { name: /In the second chapter\.\.\./ })
    .getByRole("button", { name: "Edit page" })
    .click()

  await page.getByText("Add task").click()
  await showNextToastsInfinitely(page)
  await page.click(`button:text-is("Save") >> visible=true`)
  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })
  await page.getByTestId("toast-notification").getByText("Missing exercise type for").waitFor()
  const errorToastAlert = page.getByTestId("toast-notification").getByRole("alert")
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "error-notification-test",
    waitForTheseToBeVisibleAndStable: [errorToastAlert],
    dontWaitForSpinnersToDisappear: true,
  })
  await showToastsNormally(page)
})
