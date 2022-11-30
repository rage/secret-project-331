import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

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
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await frame.waitForSelector("text=Which one is the Rust package manager?")

  await frame.click("text=rustup")

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    frame,
    headless,
    snapshotName: "multiple-choice-feedback-incorrect-answer",
    waitForThisToBeVisibleAndStable: `text=Rustup is the installer program for Rust.`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  await page.click("text=Try again")

  await frame.waitForSelector("text=Which one is the Rust package manager?")

  await frame.click("text=cargo")

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    frame,
    headless,
    snapshotName: "multiple-choice-feedback-correct-answer",
    waitForThisToBeVisibleAndStable: `text=Your answer was `,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })

  await page.click("text=Try again")

  await frame.waitForSelector("text=Which one is the Rust package manager?")

  await frame.click("text=rustup")

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    frame,
    headless,
    snapshotName: "multiple-choice-feedback-incorrect-answer-after-correct",
    waitForThisToBeVisibleAndStable: `text=Rustup is the installer program for Rust.`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })
})
