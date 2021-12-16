import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test.only("widget, matrix screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=University of Helsinki, Department of Computer Science

  // Click text=Quizzes example, multiple-choice
  await page.selectOption("select", { label: "Quizzes example, matrix" })

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/exercise?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    headless,
    snapshotName: "widget-matrix-initial",
    waitForThisToBeVisibleAndStable: `text="Create a matrix that represents 4x4"`,
    frame,
  })

  // [aria-label="row: 0, column: 0"]
  await frame.click('[aria-label="row: 0, column: 0"]')

  await frame.fill('[aria-label="row: 0, column: 0"]', "1")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    headless,
    snapshotName: "widget-matrix-filled-with-zero",
    waitForThisToBeVisibleAndStable: `text="Create a matrix that represents 4x4"`,
    frame,
  })

  // [aria-label="row: 0, column: 1"]
  await frame.click('[aria-label="row: 0, column: 1"]')

  await frame.fill('[aria-label="row: 0, column: 1"]', "2")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    headless,
    snapshotName: "widget-matrix-filled-with-two",
    waitForThisToBeVisibleAndStable: `text="Create a matrix that represents 4x4"`,
    frame,
  })
})
