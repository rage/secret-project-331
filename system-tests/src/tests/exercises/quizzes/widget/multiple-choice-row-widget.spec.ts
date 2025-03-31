import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "@/utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice row screenshot test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, multiple-choice, row" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-row-initial",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })

  await frame.getByText("#00ff00").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-row-#00ff00",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })

  await frame.getByText("#ff0000").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-row-#ff0000",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })
})
