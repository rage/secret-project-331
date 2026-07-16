/* oxlint-disable playwright/prefer-locator */
import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, scale", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, scale" })

  const iframeLocator = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-scale-initial",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(`text="Regex is generally readable."`),
      iframeLocator.locator(`text="15"`),
    ],
    screenshotTarget: iframeLocator,
  })

  await iframeLocator.locator('text=1234 >> span:has-text("1")').first().click()

  await iframeLocator.locator('text=1234567 >> span:has-text("1")').first().click()

  await iframeLocator.locator('text=123456789101112131415 >> span:has-text("1")').first().click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
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
  // The react-aria radio uses a visually hidden input under the label, so click
  // the visible label text (as a real user would) instead of the hidden input.
  await iframeLocator
    .getByRole("radiogroup", {
      name: "Regex is what some people consider to be a 'write-only' language.",
    })
    .getByText("4", { exact: true })
    .click()

  // Change third item to 15
  await iframeLocator
    .getByRole("radiogroup", { name: "Regex can be useful when parsing HTML." })
    .getByText("15", { exact: true })
    .click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-scale-mixed",
    waitForTheseToBeVisibleAndStable: [
      iframeLocator.locator(`text="Regex is generally readable."`),
      iframeLocator.locator(`text="15"`),
    ],
    screenshotTarget: iframeLocator,
  })
})
