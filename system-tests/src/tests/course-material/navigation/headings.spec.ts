import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("headings navigation works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.getByText("Introduction to Course Material").first().click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("Chapter 1User Interface").click()

  await page.getByText("1Design").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-1/design",
  )

  await page.locator('[aria-label="Open heading navigation"]').click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "headings-navigation-open",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`button:has-text("Design")`),
      page.locator(`button:has-text("First heading")`),
    ],
    screenshotTarget: page,
    replaceSomePartsWithPlaceholders: false,
  })

  await page.locator('button:has-text("Third heading")').click()

  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(500)
  const scrollY = await page.evaluate(() => {
    return window.scrollY
  })
  // Check if the page has scrolled down
  expect(scrollY).toBeGreaterThan(1000)
})
