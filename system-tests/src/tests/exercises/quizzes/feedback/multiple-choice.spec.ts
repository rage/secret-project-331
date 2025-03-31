import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test.describe(() => {
  // Chrome sometimes does not render the ui correctly after resizing the window without reloading the page.
  // This does not seem to be something we can fix, so we'll retry
  test.describe.configure({ retries: 4 })

  test("quizzes multiple-choice feedback", async ({ page, headless }, testInfo) => {
    await page.goto("http://project-331.local/organizations")

    await Promise.all([
      await page.getByText("University of Helsinki, Department of Computer Science").click(),
    ])
    await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

    await page.click(`[aria-label="Navigate to course 'Introduction to everything'"]`)

    await selectCourseInstanceIfPrompted(page)

    await page.getByText("The Basics").click()
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
    await frame.getByText("Which one is the Rust package manager?").waitFor()

    // eslint-disable-next-line playwright/no-conditional-in-test
    if (testInfo.retry && (await page.getByText("Try again").isVisible())) {
      await page.getByText("Try again").click()
      await page.getByText("Try again").waitFor({ state: "hidden" })
      await frame.getByText("Which one is the Rust package manager?").waitFor()
    }

    await frame.getByText("rustup").click()

    await page.getByText("Submit").click()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: frame,
      headless,
      testInfo,
      snapshotName: "multiple-choice-feedback-incorrect-answer",
      waitForTheseToBeVisibleAndStable: [
        frame.locator(`text=Rustup is the installer program for Rust.`),
      ],
    })

    await page.getByText("Try again").click()

    await frame.getByText("Which one is the Rust package manager?").waitFor()

    await frame.getByText("cargo").click()

    await page.getByText("Submit").click()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: frame,
      headless,
      testInfo,
      snapshotName: "multiple-choice-feedback-correct-answer",
      waitForTheseToBeVisibleAndStable: [frame.locator(`text=Your answer was `)],
    })

    await page.getByText("Try again").click()

    await frame.getByText("Which one is the Rust package manager?").waitFor()

    await frame.getByText("rustup").click()

    await page.getByText("Submit").click()

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
})
