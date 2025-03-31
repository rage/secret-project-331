import { test } from "@playwright/test"

import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorsParentIframeToViewIfNeeded,
} from "@/utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice multi screenshot test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, multiple-choice, multi" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await scrollLocatorsParentIframeToViewIfNeeded(frame)

  await frame.getByText("#00ff00").click()

  await frame.getByText("#ff0000").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-multi-answered",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })
})
