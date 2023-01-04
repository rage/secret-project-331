import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("default peer review editing", async ({ page, headless }) => {
  await page.goto("http://project-331.local/")

  await page
    .locator(
      "text=University of Helsinki, Department of Computer ScienceOrganization for Computer ",
    )
    .click()

  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] path").click()

  await page.locator("text=Pages").click()

  await page.locator("text=Page One/chapter-1/page-1Edit page >> button").first().click()

  await page.locator("text=Add peer review").check()

  await page
    .locator("text=Use course default peer review configCourse default peer review config >> div")
    .nth(1)
    .click()

  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator(`a:has-text("Course default peer review config")`).click(),
  ])

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page1,
    headless,
    snapshotName: "default-peer-review-editor",
    waitForTheseToBeVisibleAndStable: [page.locator('text="Add peer review question"')],
  })

  await page1.locator('input[type="number"]').first().click()
  // Fill input[type="number"] >> nth=0
  await page1.locator('input[type="number"]').first().fill("3")

  await page1.locator('input[type="number"]').nth(1).click()
  // Fill input[type="number"] >> nth=1
  await page1.locator('input[type="number"]').nth(1).fill("4")
  // Select ManualReviewEverything
  await page1
    .locator(
      "text=Peer review accepting strategyAutomatically accept or reject by averageAutomatic >> select",
    )
    .selectOption("ManualReviewEverything")

  await page1.locator('input[type="number"]').nth(2).click()
  // Fill input[type="number"] >> nth=2
  await page1.locator('input[type="number"]').nth(2).fill("2.5")

  await page1
    .locator(
      'text=Peer review question typeEssayLikert ScalePeer review questionThe answer was cor >> [aria-label="Delete"]',
    )
    .click()
  // Fill text=General comments
  await page1.locator("text=General comments").fill("test")

  await page1.locator("text=Save").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page1,
    headless,
    snapshotName: "default-peer-review-editor-after-save",
    waitForTheseToBeVisibleAndStable: [page.locator('text="Add peer review question"')],
  })
})
