import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test quizzes open feedback", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.click(`[aria-label="Navigate to course 'Introduction to everything'"]`),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([page.waitForNavigation(), page.click("text=The Basics")])
  expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await Promise.all([page.waitForNavigation(), page.click(`a:has-text("Page 4")`)])
  await page.waitForSelector("text=First chapters open page.")
  expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-4",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await frame.waitForSelector(
    "text=When you started studying at the uni? Give the date in yyyy-mm-dd format.",
  )

  await frame.fill(
    `input:below(:text("When you started studying at the uni? Give the date in yyyy-mm-dd format."))`,
    "19999-01-01",
  )

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "open-feedback-incorrect",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })

  await page.click("text=Try again")

  await frame.waitForSelector(
    "text=When you started studying at the uni? Give the date in yyyy-mm-dd format.",
  )

  await frame.fill(
    `input:below(:text("When you started studying at the uni? Give the date in yyyy-mm-dd format."))`,
    "1999-01-01",
  )

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "open-feedback-correct",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })
})
