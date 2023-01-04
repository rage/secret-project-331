import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("headings navigation works", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  // Click text=Introduction to Course Material >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-course-material' }*/),
    page.locator("text=Introduction to Course Material").first().click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  // Click text=Chapter 2User Experience
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-2' }*/),
    page.locator("text=Chapter 1User Interface").click(),
  ])

  // Click text=2Content rendering
  await page.locator("text=1Design").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-course-material/chapter-1/design",
  )

  // Click [aria-label="Open heading navigation"]
  await page.locator('[aria-label="Open heading navigation"]').click()

  await expectScreenshotsToMatchSnapshots({
    headless: headless ?? false,
    snapshotName: "headings-navigation-open",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`button:has-text("Design")`),
      page.locator(`button:has-text("First heading")`),
    ],
    screenshotTarget: page,
    replaceSomePartsWithPlaceholders: false,
  })

  // Click button:has-text("Heading 6")
  await page.locator('button:has-text("Third heading")').click()

  await page.waitForTimeout(500)
  const scrollY = await page.evaluate(() => {
    return window.scrollY
  })
  // Check if the page has scrolled down
  expect(scrollY).toBeGreaterThan(1000)
})
