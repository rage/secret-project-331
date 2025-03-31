import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "@/utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test.describe(() => {
  // Chrome sometimes does not render the ui correctly after resizing the window without reloading the page.
  // This does not seem to be something we can fix, so we'll retry
  test.describe.configure({ retries: 4 })

  test("quizzes open feedback", async ({ page, headless }, testInfo) => {
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

    await page.click(`a:has-text("Page 4")`)
    await page.getByText("First chapters open page.").waitFor()
    await expect(page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-4",
    )

    const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

    await frame
      .getByText("When you started studying at the uni? Give the date in yyyy-mm-dd format.")
      .waitFor()

    // eslint-disable-next-line playwright/no-conditional-in-test
    if (testInfo.retry && (await page.getByText("Try again").isVisible())) {
      await page.getByText("Try again").click()
      await page.getByText("Try again").waitFor({ state: "hidden" })
      await frame
        .getByText("When you started studying at the uni? Give the date in yyyy-mm-dd format.")
        .waitFor()
    }

    await frame
      .locator(
        `input:below(:text("When you started studying at the uni? Give the date in yyyy-mm-dd format."))`,
      )
      .fill("19999-01-01")

    await page.getByText("Submit").click()
    await page.getByText("Try again").waitFor()
    await page.locator(`text=This is an extra submit message from the teacher.`).waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "open-feedback-incorrect",
      waitForTheseToBeVisibleAndStable: [
        page.locator(`text=This is an extra submit message from the teacher.`),
      ],
    })

    await page.getByText("Try again").click()

    await frame
      .getByText("When you started studying at the uni? Give the date in yyyy-mm-dd format.")
      .waitFor()

    await frame
      .locator(
        `input:below(:text("When you started studying at the uni? Give the date in yyyy-mm-dd format."))`,
      )
      .fill("1999-01-01")

    await page.getByText("Submit").click()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "open-feedback-correct",
      waitForTheseToBeVisibleAndStable: [
        page.locator(`text=This is an extra submit message from the teacher.`),
      ],
    })
  })
})
