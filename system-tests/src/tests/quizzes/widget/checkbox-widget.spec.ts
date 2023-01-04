import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, checkbox", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Click text=Quizzes, example, checkbox
  await page.selectOption("select", { label: "Quizzes, example, checkbox" })

  const frame = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-checkbox-initial",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="The s in https stands for secure."`)],
    screenshotTarget: frame,
  })

  // Check input[type="checkbox"]
  await frame.locator('input[type="checkbox"]').check()

  // Check :nth-match(input[type="checkbox"], 2)
  await frame.locator(':nth-match(input[type="checkbox"], 2)').check()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-checkbox-both-checked",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="The s in https stands for secure."`)],
    screenshotTarget: frame,
  })

  // Uncheck :nth-match(input[type="checkbox"], 2)
  await frame.locator(':nth-match(input[type="checkbox"], 2)').uncheck()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-checkbox-other-unchecked",
    waitForTheseToBeVisibleAndStable: [page.locator(`text="The s in https stands for secure."`)],
    screenshotTarget: frame,
  })
})
