/* oxlint-disable playwright/prefer-locator */
import { test } from "@playwright/test"

import { Select } from "../../../utils/components/Select"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice column screenshot test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await Select.labelled(page, "Playground examples").chooseOption(
    "Quizzes example, multiple-choice, column",
  )

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-column-initial",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })

  await frame.getByText("#00ff00").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-column-#00ff00",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })

  await frame.getByText("#ff0000").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-column-#ff0000",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })
})
