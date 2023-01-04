import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test quizzes multiple-choice feedback", async ({ headless, page }) => {
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

  await Promise.all([page.waitForNavigation(), await page.click("text=The Basics")])
  expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=Multiple choice with feedback"),
  ])
  expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/the-multiple-choice-with-feedback",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await frame.waitFor()
  await frame.locator("text=Which one is the Rust package manager?").waitFor()

  await frame.locator("text=rustup").click()

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: frame,
    headless,
    snapshotName: "multiple-choice-feedback-incorrect-answer",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=Rustup is the installer program for Rust.`),
    ],
  })

  await page.click("text=Try again")

  await frame.locator("text=Which one is the Rust package manager?").waitFor()

  await frame.locator("text=cargo").click()

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: frame,
    headless,
    snapshotName: "multiple-choice-feedback-correct-answer",
    waitForTheseToBeVisibleAndStable: [page.locator(`text=Your answer was `)],
  })

  await page.click("text=Try again")

  await frame.locator("text=Which one is the Rust package manager?").waitFor()

  await frame.locator("text=rustup").click()

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: frame,
    headless,
    snapshotName: "multiple-choice-feedback-incorrect-answer-after-correct",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=Rustup is the installer program for Rust.`),
    ],
  })
})
