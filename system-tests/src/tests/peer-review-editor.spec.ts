import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("create peer review", async ({ page, headless }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] svg").click(),
  ])

  await Promise.all([page.waitForNavigation(), page.locator("text=Pages").click()])

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=Page One/chapter-1/page-1Edit page >> button").first().click(),
  ])

  await page.locator("text=Add peer review").check()
  // Uncheck text=Use course global peer reviewCourse default peer review config >> input[type="checkbox"]
  await page.locator("text=Use course default peer review config").uncheck()

  await page.locator("text=Add peer review question").click()
  // Fill text=Insert question here
  await page.locator("text=Insert question here").fill("first question")

  await page.locator("text=Save").nth(3).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "peer-review-editor-after-save",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="Add peer review"`)],
    screenshotTarget: page,
    clearNotifications: true,
    axeSkip: ["aria-allowed-attr", "aria-allowed-role"],
  })

  // Check text=Use course global peer reviewPeer reviews to receivePeer reviews to givePeer rev >> input[type="checkbox"]
  await page.locator("text=Use course default peer review config").click()

  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator(`a:has-text("Course default peer review config")`).click(),
  ])

  await page1.locator("text=Save").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "peer-review-editor-question-deleted",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="Add peer review"`)],
    screenshotTarget: page,
    clearNotifications: true,
    axeSkip: ["aria-allowed-attr", "aria-allowed-role"],
  })
})
