/* oxlint-disable playwright/prefer-locator */
import { test } from "@playwright/test"

import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorsParentIframeToViewIfNeeded,
} from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, matrix screenshot test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/playground")

  // Select Quizzes example, matrix
  await page.selectOption("select", { label: "Quizzes example, matrix" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await scrollLocatorsParentIframeToViewIfNeeded(frame)

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-matrix-initial",
    screenshotTarget: frame,
  })

  await frame.locator('[aria-label="row: 1, column: 1"]').click()

  // Fill [aria-label="row: 1, column: 1"]
  await frame.locator('[aria-label="row: 1, column: 1"]').fill("1")

  await frame.locator('[aria-label="row: 2, column: 2"]').click()

  // Fill [aria-label="row: 2, column: 2"]
  await frame.locator('[aria-label="row: 2, column: 2"]').fill("2")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-matrix-two-cells-filled",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`input[name="1"]`),
      frame.locator(`input[name="2"]`),
    ],
    screenshotTarget: frame,
  })

  await frame.locator('[aria-label="row: 1, column: 3"]').click()

  // Fill [aria-label="row: 1, column: 3"]
  await frame.locator('[aria-label="row: 1, column: 3"]').fill("5")

  await frame.locator('[aria-label="row: 6, column: 6"]').click()

  // Fill [aria-label="row: 6, column: 6"]
  await frame.locator('[aria-label="row: 6, column: 6"]').fill("6")

  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    snapshotName: "widget-matrix-whole-matrice-is-active",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`input[name="1"]`),
      frame.locator(`input[name="2"]`),
      frame.locator(`input[name="5"]`),
      frame.locator(`input[name="6"]`),
    ],
    screenshotTarget: frame,
  })
})
