import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("quizzes multiple-choice feedback", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

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

  await Promise.all([
    await page.getByRole("link", { name: "9 Multiple choice with feedback" }).click(),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/the-multiple-choice-with-feedback",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
  await frame.waitFor()
  await frame.locator("text=Which one is the Rust package manager?").waitFor()

  await frame.locator("text=rustup").click()

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: frame,
    headless,
    testInfo,
    snapshotName: "multiple-choice-feedback-incorrect-answer",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text=Rustup is the installer program for Rust.`),
    ],
  })

  await page.locator("text=Try again").click()

  await frame.locator("text=Which one is the Rust package manager?").waitFor()

  await frame.locator("text=cargo").click()

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: frame,
    headless,
    testInfo,
    snapshotName: "multiple-choice-feedback-correct-answer",
    waitForTheseToBeVisibleAndStable: [frame.locator(`text=Your answer was `)],
  })

  await page.locator("text=Try again").click()

  await frame.locator("text=Which one is the Rust package manager?").waitFor()

  await frame.locator("text=rustup").click()

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: frame,
    headless,
    testInfo,
    snapshotName: "multiple-choice-feedback-incorrect-answer-after-correct",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text=Rustup is the installer program for Rust.`),
    ],
  })
})
