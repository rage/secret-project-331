import { test } from "@playwright/test"

import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorsParentIframeToViewIfNeeded,
} from "@/utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice multi screenshot test with long text", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, multiple-choice, long text" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await scrollLocatorsParentIframeToViewIfNeeded(frame)

  await frame.locator(`text="short answer"`).click()

  await frame.locator(`text="short answer"`).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-multiple-choice-multi-long-answers",
    waitForTheseToBeVisibleAndStable: [frame.locator(`text="short answer"`)],
    screenshotTarget: frame,
  })
})
