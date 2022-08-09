import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await page.locator("text=University of Helsinki, Department of Computer Science").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  // Click [aria-label="Manage course \'Introduction to everything\'"] path
  await page.locator("[aria-label=\"Manage course \\'Introduction to everything\\'\"] path").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5",
  )

  // Click text=Pages
  await page.locator("text=Pages").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/pages",
  )

  // Click text=Page One/chapter-1/page-1Edit page >> button >> nth=0
  await page.locator("text=Page One/chapter-1/page-1Edit page >> button").first().click()
  // await expect(page).toHaveURL(
  //   "http://project-331.local/cms/pages/a9118591-e6be-4d86-ba7d-9145173122f7",
  // )

  // Check input[type="checkbox"] >> nth=1
  await page.locator('input[type="checkbox"]').nth(1).check()

  // Click input[type="number"] >> nth=2
  await page.locator('input[type="number"]').nth(2).click()

  // Fill input[type="number"] >> nth=2
  await page.locator('input[type="number"]').nth(2).fill("1")

  // Click input[type="number"] >> nth=3
  await page.locator('input[type="number"]').nth(3).click()

  // Fill input[type="number"] >> nth=3
  await page.locator('input[type="number"]').nth(3).fill("2")

  // Select ManualReviewEverything
  await page
    .locator(
      "text=Peer review accepting strategyAutomatically accept or reject by averageAutomatic >> select",
    )
    .selectOption("ManualReviewEverything")

  // Click input[type="number"] >> nth=4
  await page.locator('input[type="number"]').nth(4).click()

  // Fill input[type="number"] >> nth=4
  await page.locator('input[type="number"]').nth(4).fill("0.5")

  // Click text=Add peer review question
  await page.locator("text=Add peer review question").click()

  // Click textarea
  await page.locator("textarea").click()

  // Fill textarea
  await page.locator("textarea").fill("test1")

  // Click text=Add peer review question
  await page.locator("text=Add peer review question").click()

  // Click textarea >> nth=1
  await page.locator("textarea").nth(1).click()

  // Fill textarea >> nth=1
  await page.locator("textarea").nth(1).fill("test2")

  // Select Scale
  await page
    .locator("text=Peer review question typeEssayLikert ScalePeer review questiontest2 >> select")
    .selectOption("Scale")

  // Click text=Save >> nth=3
  await page.locator("text=Save").nth(3).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "peer-review-editor-after-save",
    waitForThisToBeVisibleAndStable: `text="Add peer review"`,
    page,
    clearNotifications: true,
    axeSkip: true,
  })

  // Click text=Peer review question typeEssayLikert ScalePeer review questiontest1 >> [aria-label="Delete"]
  await page
    .locator(
      'text=Peer review question typeEssayLikert ScalePeer review questiontest1 >> [aria-label="Delete"]',
    )
    .click()

  // Click text=Save >> nth=3
  await page.locator("text=Save").nth(3).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "peer-review-editor-question-deleted",
    waitForThisToBeVisibleAndStable: `text="Add peer review"`,
    page,
    clearNotifications: true,
    axeSkip: true,
  })
})
