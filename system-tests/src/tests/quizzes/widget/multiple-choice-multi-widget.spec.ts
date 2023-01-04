import { test } from "@playwright/test"

import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorOrLocatorsParentIframeToViewIfNeeded,
} from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice multi screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=University of Helsinki, Department of Computer Science

  // Click text=Quizzes example, multiple-choice
  await page.selectOption("select", { label: "Quizzes example, multiple-choice, multi" })

  const frame = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await scrollLocatorOrLocatorsParentIframeToViewIfNeeded(frame)

  await frame.locator("text=#00ff00").click()

  await frame.locator("text=#ff0000").click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-multi-answered",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Which of the color codes represent the color"`),
    ],
    screenshotTarget: frame,
  })
})
