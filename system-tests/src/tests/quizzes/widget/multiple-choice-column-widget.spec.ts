import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice column screenshot test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, multiple-choice, column" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-column-initial",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })

  await frame.locator("text=#00ff00").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-column-#00ff00",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })

  await frame.locator("text=#ff0000").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-column-#ff0000",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })
})
