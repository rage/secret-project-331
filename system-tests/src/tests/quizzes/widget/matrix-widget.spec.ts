import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, matrix screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Select Quizzes example, matrix
  await page.selectOption("select", { label: "Quizzes example, matrix" })

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe?width=500")
    }),
  )

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await (await frame.frameElement()).scrollIntoViewIfNeeded()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-matrix-initial",
    frame,
  })

  // Click [aria-label="row: 0, column: 0"]
  await frame.click('[aria-label="row: 0, column: 0"]')

  // Fill [aria-label="row: 0, column: 0"]
  await frame.fill('[aria-label="row: 0, column: 0"]', "1")

  // Click [aria-label="row: 1, column: 1"]
  await frame.click('[aria-label="row: 1, column: 1"]')

  // Fill [aria-label="row: 1, column: 1"]
  await frame.fill('[aria-label="row: 1, column: 1"]', "2")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-matrix-two-cells-filled",
    waitForThisToBeVisibleAndStable: [`input[name="1"]`, `input[name="2"]`],
    frame,
  })

  // Click [aria-label="row: 0, column: 2"]
  await frame.click('[aria-label="row: 0, column: 2"]')

  // Fill [aria-label="row: 0, column: 2"]
  await frame.fill('[aria-label="row: 0, column: 2"]', "5")

  // Click [aria-label="row: 5, column: 5"]
  await frame.click('[aria-label="row: 5, column: 5"]')

  // Fill [aria-label="row: 5, column: 5"]
  await frame.fill('[aria-label="row: 5, column: 5"]', "6")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-matrix-whole-matrice-is-active",
    waitForThisToBeVisibleAndStable: [
      `input[name="1"]`,
      `input[name="2"]`,
      `input[name="5"]`,
      `input[name="6"]`,
    ],
    frame,
  })
})
