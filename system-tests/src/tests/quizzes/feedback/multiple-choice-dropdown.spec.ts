import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test quizzes multiple-choice-dropdown", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.click(`[aria-label="Navigate to course 'Introduction to everything'"]`),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([page.waitForNavigation(), await page.click("text=The Basics")])
  expect(page.url()).toBe(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await Promise.all([page.waitForNavigation(), await page.click("text=Page 5")])
  expect(page.url()).toBe(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-5",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  await frame.waitForSelector("text=Choose the right answer from given options.")

  await frame.selectOption(
    `select:right-of(:text("Choose the right answer from given options."))`,
    { label: "The Wright answer" },
  )

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "multiple-choice-dropdown-feedback-incorrect-answer",
    waitForThisToBeVisibleAndStable: `text=This is an extra submit message from the teacher.`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  await page.click("text=Try again")

  await frame.waitForSelector("text=Choose the right answer from given options.")

  await frame.selectOption(
    `select:right-of(:text("Choose the right answer from given options."))`,
    { label: "The right answer" },
  )

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "multiple-choice-dropdown-feedback-correct-answer",
    waitForThisToBeVisibleAndStable: `text=This is an extra submit message from the teacher.`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  await page.click("text=Try again")

  await frame.waitForSelector("text=Choose the right answer from given options.")

  await frame.selectOption(
    `select:right-of(:text("Choose the right answer from given options."))`,
    { label: "The Wright answer" },
  )

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "multiple-choice-dropdown-feedback-incorrect-answer-after-correct",
    waitForThisToBeVisibleAndStable: `text=This is an extra submit message from the teacher.`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })
})
