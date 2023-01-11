import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, checkbox", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes, example, checkbox" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-checkbox-initial",
    waitForTheseToBeVisibleAndStable: [frame.locator(`text="The s in https stands for secure."`)],
    screenshotTarget: frame,
  })

  // Check input[type="checkbox"]
  await frame.locator('input[type="checkbox"]').first().check()

  // Check :nth-match(input[type="checkbox"], 2)
  await frame.locator(':nth-match(input[type="checkbox"], 2)').check()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-checkbox-both-checked",
    waitForTheseToBeVisibleAndStable: [frame.locator(`text="The s in https stands for secure."`)],
    screenshotTarget: frame,
  })

  // Uncheck :nth-match(input[type="checkbox"], 2)
  await frame.locator(':nth-match(input[type="checkbox"], 2)').uncheck()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-checkbox-other-unchecked",
    waitForTheseToBeVisibleAndStable: [frame.locator(`text="The s in https stands for secure."`)],
    screenshotTarget: frame,
  })
})
