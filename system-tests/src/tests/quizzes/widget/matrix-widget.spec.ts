import { test } from "@playwright/test"

import {
  getLocatorForNthExerciseServiceIframe,
  scrollLocatorOrLocatorsParentIframeToViewIfNeeded,
} from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, matrix screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Select Quizzes example, matrix
  await page.selectOption("select", { label: "Quizzes example, matrix" })

  const frame = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await scrollLocatorOrLocatorsParentIframeToViewIfNeeded(frame)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-matrix-initial",
    screenshotTarget: frame,
  })

  // Click [aria-label="row: 0, column: 0"]
  await frame.locator('[aria-label="row: 0, column: 0"]').click()

  // Fill [aria-label="row: 0, column: 0"]
  await frame.locator('[aria-label="row: 0, column: 0"]').fill("1")

  // Click [aria-label="row: 1, column: 1"]
  await frame.locator('[aria-label="row: 1, column: 1"]').click()

  // Fill [aria-label="row: 1, column: 1"]
  await frame.locator('[aria-label="row: 1, column: 1"]').fill("2")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-matrix-two-cells-filled",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`input[name="1"]`),
      frame.locator(`input[name="2"]`),
    ],
    screenshotTarget: frame,
  })

  // Click [aria-label="row: 0, column: 2"]
  await frame.locator('[aria-label="row: 0, column: 2"]').click()

  // Fill [aria-label="row: 0, column: 2"]
  await frame.locator('[aria-label="row: 0, column: 2"]').fill("5")

  // Click [aria-label="row: 5, column: 5"]
  await frame.locator('[aria-label="row: 5, column: 5"]').click()

  // Fill [aria-label="row: 5, column: 5"]
  await frame.locator('[aria-label="row: 5, column: 5"]').fill("6")

  await expectScreenshotsToMatchSnapshots({
    headless,
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
