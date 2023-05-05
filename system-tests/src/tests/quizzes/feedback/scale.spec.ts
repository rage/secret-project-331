import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test quizzes open feedback", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    await page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.click(`[aria-label="Navigate to course 'Introduction to everything'"]`)

  await selectCourseInstanceIfPrompted(page)

  await page.locator("text=The Basics").click()

  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await page.locator("text=scale").first().click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/scale",
  )
  await page
    .frameLocator("iframe")
    .locator('text=What is this? 12345 >> [aria-label="\\34 "]')
    .check()
  await page.frameLocator("iframe").locator('text=12345678 >> [aria-label="\\33 "]').check()
  await page
    .frameLocator("iframe")
    .locator('text=Please rate this 12 >> [aria-label="\\31 "]')
    .check()
  await page.locator("text=Submit").click()
  await page.frameLocator("iframe").locator(`input[aria-label="3"]:disabled`).first().waitFor()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "scale-feedback",
  })
})
