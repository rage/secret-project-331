import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"
test.use({
  storageState: "src/states/user@example.com.json",
})

test("Can start an exam and can answer exercises", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/org/uh-cs/exams/8e202d37-3a26-4181-b9e4-0560b90c0ccb")
  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "exam-instructions-page",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Ongoing plenty of time"),
      page.getByText("Submissions are no longer accepted after"),
      page.getByText("You have 730 minutes to complete the exam after starting"),
    ],
  })

  page.on("dialog", (dialog) => dialog.accept())
  await page.locator(`button:text("Start the exam!")`).click()
  await page
    .getByText("In this exam you're supposed to answer to two easy questions. Good luck!")
    .waitFor()
  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "exam-started",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("In this exam you're supposed to answer to two easy questions. Good luck!"),
    ],
    // Only should happen in seeded data
    axeSkip: ["frame-title-unique"],
  })
  await page.evaluate(() => {
    window.scrollTo(0, 929)
  })

  await page
    .frameLocator("iframe")
    .first()
    .getByText("Which one is the Rust package manager?")
    .first()
    .waitFor()

  await page.frameLocator("iframe").first().getByText("cargo").click()
  await page.locator("button:text('Submit')").first().click()
  await page.getByRole("button", { name: "try again" }).waitFor()
  await page
    .frameLocator("iframe")
    .first()
    .getByText("Which one is the Rust package manager?")
    .first()
    .waitFor()
  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "exam-exercise-answered",
    waitForTheseToBeVisibleAndStable: [page.getByRole("button", { name: "try again" })],
    // Only should happen in seeded data
    axeSkip: ["frame-title-unique"],
  })

  await page.locator("button:text('Try again')").first().click()

  // Make sure the exercise remembered the previous choice
  await page
    .frameLocator("iframe")
    .first()
    .locator("role=button[pressed]")
    .getByText("cargo")
    .waitFor({ state: "visible" })

  // Make sure this works even after reloading the page
  await page.reload()
  await page.getByText("Answer this question.").first().scrollIntoViewIfNeeded()
  await page.locator("button:text('Try again')").first().click()
  await page
    .frameLocator("iframe")
    .first()
    .locator("role=button[pressed]")
    .getByText("cargo")
    .waitFor({ state: "visible" })
})
