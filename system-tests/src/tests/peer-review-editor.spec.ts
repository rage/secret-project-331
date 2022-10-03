import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("create peer review", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  // Click [aria-label="Manage course \'Introduction to everything\'"] svg
  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] svg").click(),
  ])

  // Click text=Pages
  await Promise.all([page.waitForNavigation(), page.locator("text=Pages").click()])

  // Click text=Page One/chapter-1/page-1Edit page >> button >> nth=0
  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=Page One/chapter-1/page-1Edit page >> button").first().click(),
  ])

  await page.locator("text=Add peer review").check()
  // Uncheck text=Use course global peer reviewCourse default peer review config >> input[type="checkbox"]
  await page
    .locator(
      'text=Use course default peer reviewCourse default peer review config >> input[type="checkbox"]',
    )
    .uncheck()
  // Click text=Add peer review question
  await page.locator("text=Add peer review question").click()
  // Fill text=Insert question here
  await page.locator("text=Insert question here").fill("first question")

  // Click text=Save >> nth=3
  await page.locator("text=Save").nth(3).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "peer-review-editor-after-save",
    waitForThisToBeVisibleAndStable: `text="Add peer review"`,
    page,
    clearNotifications: true,
    axeSkip: ["aria-allowed-attr", "aria-allowed-role"],
  })

  // Check text=Use course global peer reviewPeer reviews to receivePeer reviews to givePeer rev >> input[type="checkbox"]
  await page.locator("text=Use course default peer review config").click()
  // Click text=Course default peer review config
  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator("text=Course default peer review config").click(),
  ])
  // Click text=Save
  await page1.locator("text=Save").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "peer-review-editor-question-deleted",
    waitForThisToBeVisibleAndStable: `text="Add peer review"`,
    page,
    clearNotifications: true,
    axeSkip: ["aria-allowed-attr", "aria-allowed-role"],
  })
})
