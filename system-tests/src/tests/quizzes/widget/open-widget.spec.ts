import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, open", async ({ page, headless }) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, open" })

  const iframeLocator = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-open-empty",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`),
      page.locator(`text="Date formats"`),
    ],
    screenshotTarget: iframeLocator,
  })

  if (!iframeLocator) {
    throw new Error("Could not find frame")
  }

  // Fill input[type="text"]
  await iframeLocator
    .locator(
      'input:below(:text("Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."))',
    )
    .fill("2024")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-open-invalid",
    waitForTheseToBeVisibleAndStable: [
      page.locator(
        `text="The answer does not match the answer format specified for this exercise."`,
      ),
      page.locator(`text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`),
      page.locator(`text="Date formats"`),
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
    snapshotName: "widget-open-valid",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`),
      page.locator(`text="Date formats"`),
    ],
    screenshotTarget: iframeLocator,
  })
})
