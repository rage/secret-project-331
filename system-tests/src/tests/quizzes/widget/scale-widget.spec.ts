import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, scale", async ({ page, headless }) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, scale" })

  const iframeLocator = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-scale-initial",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(`text="Regex is generally readable."`),
      iframeLocator.locator(`text="15"`),
    ],
    screenshotTarget: iframeLocator,
  })

  await iframeLocator.locator('input[type="radio"]').first().click()

  await iframeLocator.locator('text=1234567 >> input[type="radio"]').first().click()

  await iframeLocator.locator('text=123456789101112131415 >> input[type="radio"]').first().click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-scale-leftmost",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(`text="Regex is generally readable."`),
      iframeLocator.locator(`text="15"`),
    ],
    screenshotTarget: iframeLocator,
  })

  // NB! These only seem to work when the input value is greater than of the previous max option.
  // No idea how to fix.

  // Change second item to 4
  await iframeLocator.locator("div:nth-child(2) div:nth-child(5) input").first().click()

  // Change third item to 15
  await iframeLocator.locator("div:nth-child(3) div:nth-child(15) input").first().click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-scale-mixed",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(`text="Regex is generally readable."`),
      iframeLocator.locator(`text="15"`),
    ],
    screenshotTarget: iframeLocator,
  })
})
