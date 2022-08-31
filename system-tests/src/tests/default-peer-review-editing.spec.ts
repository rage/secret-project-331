import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("default peer review editing", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer ScienceOrganization for Computer
  await page
    .locator(
      "text=University of Helsinki, Department of Computer ScienceOrganization for Computer ",
    )
    .click()

  // Click [aria-label="Manage course \'Introduction to everything\'"] path
  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] path").click()

  // Click text=Pages
  await page.locator("text=Pages").click()

  // Click text=Page One/chapter-1/page-1Edit page >> button >> nth=0
  await page.locator("text=Page One/chapter-1/page-1Edit page >> button").first().click()

  // Click text=Use course global peer reviewCourse default peer review config >> div >> nth=1
  await page
    .locator("text=Use course global peer reviewCourse default peer review config >> div")
    .nth(1)
    .click()
  // Click text=Course default peer review config
  const [page1] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator("text=Course default peer review config").click(),
  ])

  await expectScreenshotsToMatchSnapshots({
    page: page1,
    headless,
    snapshotName: "default-peer-review-editor",
    waitForThisToBeVisibleAndStable: ['text="Add peer review question"'],
  })

  // Click input[type="number"] >> nth=0
  await page1.locator('input[type="number"]').first().click()
  // Fill input[type="number"] >> nth=0
  await page1.locator('input[type="number"]').first().fill("3")
  // Click input[type="number"] >> nth=1
  await page1.locator('input[type="number"]').nth(1).click()
  // Fill input[type="number"] >> nth=1
  await page1.locator('input[type="number"]').nth(1).fill("4")
  // Select ManualReviewEverything
  await page1
    .locator(
      "text=Peer review accepting strategyAutomatically accept or reject by averageAutomatic >> select",
    )
    .selectOption("ManualReviewEverything")
  // Click input[type="number"] >> nth=2
  await page1.locator('input[type="number"]').nth(2).click()
  // Fill input[type="number"] >> nth=2
  await page1.locator('input[type="number"]').nth(2).fill("2.5")
  // Click text=Peer review question typeEssayLikert ScalePeer review questionThe answer was cor >> [aria-label="Delete"]
  await page1
    .locator(
      'text=Peer review question typeEssayLikert ScalePeer review questionThe answer was cor >> [aria-label="Delete"]',
    )
    .click()
  // Fill text=General comments
  await page1.locator("text=General comments").fill("test")
  // Click text=Save
  await page1.locator("text=Save").click()

  await expectScreenshotsToMatchSnapshots({
    page: page1,
    headless,
    snapshotName: "default-peer-review-editor-after-save",
    waitForThisToBeVisibleAndStable: ['text="Add peer review question"'],
  })
})
