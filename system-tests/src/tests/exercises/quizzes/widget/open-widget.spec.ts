import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, open", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, open" })

  const iframeLocator = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-open-empty",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(
        `text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`,
      ),
      iframeLocator.locator(`text="Date formats"`),
    ],
    screenshotTarget: iframeLocator,
  })

  // Fill input[type="text"]
  await iframeLocator
    .locator(
      'input:below(:text("Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."))',
    )
    .fill("2024")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-open-invalid",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(
        `text="The answer does not match the answer format specified for this exercise."`,
      ),
      iframeLocator.locator(
        `text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`,
      ),
      iframeLocator.locator(`text="Date formats"`),
    ],
    screenshotTarget: iframeLocator,
  })

  // Fill input[type="text"]
  await iframeLocator
    .locator(
      'input:below(:text("Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."))',
    )
    .fill("2024-02-29")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-open-valid",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(
        `text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`,
      ),
      iframeLocator.locator(`text="Date formats"`),
    ],
    screenshotTarget: iframeLocator,
  })
})
