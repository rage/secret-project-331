import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test quizzes multiple-choice-dropdown", async ({ headless, page }) => {
  await page.goto(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-5",
  )

  await selectCourseInstanceIfPrompted(page)

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await frame.locator("text=Choose the right answer from given options.").waitFor()

  await frame
    .locator(`select:right-of(:text("Choose the right answer from given options."))`)
    .selectOption({ label: "The Wright answer" })

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "multiple-choice-dropdown-feedback-incorrect-answer",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })

  await page.locator("text=Try again").click()

  await frame.locator("text=Choose the right answer from given options.").waitFor()

  await frame
    .locator(`select:right-of(:text("Choose the right answer from given options."))`)
    .selectOption({
      label: "The right answer",
    })

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "multiple-choice-dropdown-feedback-correct-answer",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })

  await page.locator("text=Try again").click()

  await frame.locator("text=Choose the right answer from given options.").waitFor()

  await frame
    .locator(`select:right-of(:text("Choose the right answer from given options."))`)
    .selectOption({
      label: "The Wright answer",
    })

  await page.locator("text=Submit").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "multiple-choice-dropdown-feedback-incorrect-answer-after-correct",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
    ],
  })
})
