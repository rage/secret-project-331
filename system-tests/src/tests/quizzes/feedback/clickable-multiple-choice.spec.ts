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

  test("quizzes clickable multiple-choice feedback", async ({ page, headless }, testInfo) => {
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

    await page.click(`a:has-text("Page 6")`)
    await expect(page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-6",
    )

    // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
    const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)
    await frame.getByText("Pick all the programming languages from below").waitFor()

    await frame.locator(`button:text("AC")`).click()
    await frame.locator(`button:text("Jupiter")`).click()

    await page.getByText("Submit").click()

    await page.getByText("Try again").waitFor()
    await page.getByText(`This is an extra submit message from the teacher.`).waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "clickable-multiple-choice-incorrect-answer",
      waitForTheseToBeVisibleAndStable: [
        page.locator(`text=This is an extra submit message from the teacher.`),
      ],
    })

    await page.getByText("Try again").click()
    // Unselect all the options
    await frame.getByText("Pick all the programming languages from below").waitFor()
    await frame.locator(`button:text("AC")`).click()
    await frame.locator(`button:text("Jupiter")`).click()

    await frame.locator(`button:text("Java")`).click()
    await frame.locator(`button:text("Erlang")`).click()

    await page.getByText("Submit").click()
    await page.getByText("Try again").waitFor()
    await page.getByText(`This is an extra submit message from the teacher.`).waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "clickable-multiple-choice-correct-answer",
      waitForTheseToBeVisibleAndStable: [
        page.getByText(`This is an extra submit message from the teacher.`),
      ],
    })
  })
})
