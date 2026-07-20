/* oxlint-disable playwright/prefer-locator */
import { test } from "@playwright/test"

import { showNextToastsInfinitely, showToastsNormally } from "../../utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

// Both tests edit the same page in the same course, so they must run in order on the same worker:
// the error test relies on the page still having its seed title ("In the second chapter..."), and the
// success test renames that page to "New title". They used to live in separate files and raced, so
// the error-notification screenshot sometimes captured the title the success test had left behind in
// the shared database. Running them serially here keeps the shared page state deterministic.
test.describe.serial("Query/mutation notifications", () => {
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
})
