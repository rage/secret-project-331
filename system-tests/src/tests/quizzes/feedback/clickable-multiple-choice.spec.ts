import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test quizzes clickable multiple-choice feedback", async ({ headless, page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    await page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.click(`[aria-label="Navigate to course 'Introduction to everything'"]`),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([page.waitForNavigation(), page.locator("text=The Basics").click()])
  expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await Promise.all([page.waitForNavigation(), page.click(`a:has-text("Page 6")`)])
  expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-6",
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

  await frame.waitForSelector("text=Pick all the programming languages from below")

  await frame.click(`button:text("AC")`)
  await frame.click(`button:text("Jupiter")`)

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "clickable-multiple-choice-incorrect-answer",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })

  await page.locator("text=Try again").click()
  // Unselect all the options
  await frame.waitForSelector("text=Pick all the programming languages from below")
  await frame.click(`button:text("AC")`)
  await frame.click(`button:text("Jupiter")`)

  await frame.click(`button:text("Java")`)
  await frame.click(`button:text("Erlang")`)
  await frame.click(`button:text("Rust")`)

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "clickable-multiple-choice-correct-answer",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })

  await page.locator("text=Try again").click()
  // Unselect all the options
  await frame.waitForSelector("text=Pick all the programming languages from below")
  await frame.click(`button:text("Java")`)
  await frame.click(`button:text("Erlang")`)
  await frame.click(`button:text("Rust")`)

  await frame.click(`button:text("Jupiter")`)
  await frame.click(`button:text("Rust")`)

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "clickable-multiple-choice-incorrect-answer-after-correct",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })
})
