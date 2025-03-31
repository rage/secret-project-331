import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test.describe(() => {
  // Chrome sometimes does not render the ui correctly after resizing the window without reloading the page.
  // This does not seem to be something we can fix, so we'll retry
  test.describe.configure({ retries: 4 })

  test("quizzes vector feedback", async ({ page, headless }, testInfo) => {
    await page.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/vector",
    )

    await selectCourseInstanceIfPrompted(page)

    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByText("Answer")
      .first()
      .waitFor()

    // eslint-disable-next-line playwright/no-conditional-in-test
    if (testInfo.retry && (await page.getByText("Try again").isVisible())) {
      await page.getByText("Try again").click()
      await page.getByText("Try again").waitFor({ state: "hidden" })
      await page
        .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
        .getByText("Answer")
        .first()
        .waitFor()
    }

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-initial",
      scrollToYCoordinate: 270,
    })

    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByLabel("Answer", { exact: true })
      .nth(0)
      .fill("a")
    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByLabel("Answer", { exact: true })
      .nth(1)
      .fill("4")
    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByLabel("Answer", { exact: true })
      .nth(2)
      .fill("5")

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-filled",
      scrollToYCoordinate: 270,
    })

    await page.getByRole("button", { name: "Submit" }).click()

    await page.frameLocator("iframe").getByText("Your answer was not correct.").first().waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-feedback-incorrect",
      scrollToYCoordinate: 270,
    })

    await page.getByRole("button", { name: "try again" }).click()

    await page.frameLocator("iframe").getByLabel("Answer").first().fill("3")

    await page.getByRole("button", { name: "Submit" }).click()

    await page.frameLocator("iframe").getByText("Your answer was correct.").first().waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-feedback-correct",
      scrollToYCoordinate: 270,
    })

    await page.getByRole("button", { name: "try again" }).click()

    await page.frameLocator("iframe").getByLabel("Answer").first().fill("a")

    await page.getByRole("button", { name: "Submit" }).click()

    await page.frameLocator("iframe").getByText("Your answer was not correct.").first().waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-feedback-incorrect-with-model-solution",
      scrollToYCoordinate: 270,
    })
  })
})
