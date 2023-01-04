import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/user@example.com.json",
})

test("Can start an exam and can answer exercises", async ({ page, headless }) => {
  // Go to http://project-331.local/org/uh-cs/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c
  await page.goto("http://project-331.local/org/uh-cs/exams/8e202d37-3a26-4181-b9e4-0560b90c0ccb")
  await expectScreenshotsToMatchSnapshots({
    headless,
    screenshotTarget: page,
    snapshotName: "exam-instructions-page",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Ongoing plenty of time"),
      page.locator("text=Submissions are no longer accepted after"),
      page.locator("text=You have 730 minutes to complete the exam after starting"),
    ],
  })

  page.on("dialog", (dialog) => dialog.accept())
  await page.locator(`button:text("Start the exam!")`).click()
  await expectScreenshotsToMatchSnapshots({
    headless,
    screenshotTarget: page,
    snapshotName: "exam-started",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=In this exam you're supposed to answer to two easy questions. Good luck!"),
    ],
    // Only should happen in seeded data
    axeSkip: ["frame-title-unique"],
  })
  await page.evaluate(() => {
    window.scrollTo(0, 500)
  })
  // Click text=Answer this question. >> nth=0
  await page.locator("text=Answer this question.").first().scrollIntoViewIfNeeded()
  await page
    .frameLocator("iframe")
    .first()
    .locator("text=Which one is the Rust package manager?")
    .first()
    .waitFor()
  // Click text=a
  await page.frameLocator("iframe").first().locator("text=cargo").click()
  await page.locator("button:text('Submit')").first().click()
  await expectScreenshotsToMatchSnapshots({
    headless,
    screenshotTarget: page,
    snapshotName: "exam-exercise-answered",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Try again")],
    // Only should happen in seeded data
    axeSkip: ["frame-title-unique"],
  })

  await page.locator("button:text('Try again')").first().click()

  // Make sure the exercise remembered the previous choice
  await page
    .frameLocator("iframe")
    .first()
    .locator("role=button[pressed]")
    .locator("text=cargo")
    .waitFor({ state: "visible" })

  // Make sure this works even after reloading the page
  await page.reload()
  await page.locator("text=Answer this question.").first().scrollIntoViewIfNeeded()
  await page.locator("button:text('Try again')").first().click()
  await page
    .frameLocator("iframe")
    .first()
    .locator("role=button[pressed]")
    .locator("text=cargo")
    .waitFor({ state: "visible" })
})
