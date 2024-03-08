import { test } from "@playwright/test"

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

  test("quizzes multiple-choice-dropdown", async ({ page, headless }, testInfo) => {
    await page.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-5",
    )

    await selectCourseInstanceIfPrompted(page)

    const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

    await frame.getByText("Choose the right answer from given options.").waitFor()

    await frame
      .locator(`select:below(:text("Choose the right answer from given options."))`)
      .selectOption({ label: "The Wright answer" })

    await page.getByText("Submit").click()
    await page.getByText("Try again").waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "multiple-choice-dropdown-feedback-incorrect-answer",
      waitForTheseToBeVisibleAndStable: [
        page.locator(`text=This is an extra submit message from the teacher.`),
      ],
    })

    await page.getByText("Try again").click()

    await frame.getByText("Choose the right answer from given options.").waitFor()

    await frame
      .locator(`select:below(:text("Choose the right answer from given options."))`)
      .selectOption({
        label: "The right answer",
      })

    await page.getByText("Submit").click()
    await page.getByText("Try again").waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "multiple-choice-dropdown-feedback-correct-answer",
      waitForTheseToBeVisibleAndStable: [
        page.locator(`text=This is an extra submit message from the teacher.`),
      ],
    })

    await page.getByText("Try again").click()

    await frame.getByText("Choose the right answer from given options.").waitFor()

    await frame
      .locator(`select:below(:text("Choose the right answer from given options."))`)
      .selectOption({
        label: "The Wright answer",
      })

    await page.getByText("Submit").click()
    await page.getByText("Try again").waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "multiple-choice-dropdown-feedback-incorrect-answer-after-correct",
      waitForTheseToBeVisibleAndStable: [
        page.locator(`text=This is an extra submit message from the teacher.`),
      ],
    })
  })
})
