import { test } from "@playwright/test"

import { NO_H1 } from "@/utils/accessibilityCheck"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getExerciseTaskFrame } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test.describe("Quizzes vector feedback", () => {
  // Chrome sometimes does not render the ui correctly after resizing the window without reloading the page.
  // This does not seem to be something we can fix, so we'll retry
  test.describe.configure({ retries: 4 })

  test("quizzes vector feedback", async ({ page, headless }, testInfo) => {
    await page.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/vector",
    )

    await selectCourseInstanceIfPrompted(page)

    await getExerciseTaskFrame(page, 1).getByLabel("X", { exact: true }).waitFor()

    // oxlint-disable-next-line playwright/no-conditional-in-test
    if (testInfo.retry && (await page.getByText("Try again").isVisible())) {
      await page.getByText("Try again").click()
      await page.getByText("Try again").waitFor({ state: "hidden" })
      await getExerciseTaskFrame(page, 1).getByLabel("X", { exact: true }).waitFor()
    }

    await expectScreenshotsToMatchSnapshots({
      axeSkip: [NO_H1],
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-initial",
      scrollToYCoordinate: 270,
    })

    await getExerciseTaskFrame(page, 1).getByLabel("X", { exact: true }).fill("a")
    await getExerciseTaskFrame(page, 1).getByLabel("Y", { exact: true }).fill("4")
    await getExerciseTaskFrame(page, 1).getByLabel("Z", { exact: true }).fill("5")

    await expectScreenshotsToMatchSnapshots({
      axeSkip: [NO_H1],
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-filled",
      scrollToYCoordinate: 270,
    })

    await page.getByRole("button", { name: "Submit" }).click()

    await page.frameLocator("iframe").getByText("Your answer was not correct.").first().waitFor()

    await expectScreenshotsToMatchSnapshots({
      axeSkip: [NO_H1],
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-feedback-incorrect",
      scrollToYCoordinate: 270,
    })

    await page.getByRole("button", { name: "try again" }).click()

    await page.frameLocator("iframe").getByLabel("X", { exact: true }).first().fill("3")

    await page.getByRole("button", { name: "Submit" }).click()

    await page.frameLocator("iframe").getByText("Your answer was correct.").first().waitFor()

    await expectScreenshotsToMatchSnapshots({
      axeSkip: [NO_H1],
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-feedback-correct",
      scrollToYCoordinate: 270,
    })

    await page.getByRole("button", { name: "try again" }).click()

    await page.frameLocator("iframe").getByLabel("X", { exact: true }).first().fill("a")

    await page.getByRole("button", { name: "Submit" }).click()

    await page.frameLocator("iframe").getByText("Your answer was not correct.").first().waitFor()

    await expectScreenshotsToMatchSnapshots({
      axeSkip: [NO_H1],
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "vector-feedback-incorrect-with-model-solution",
      scrollToYCoordinate: 270,
    })
  })
})
