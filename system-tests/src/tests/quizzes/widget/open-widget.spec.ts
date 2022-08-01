import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, open", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Click text=Quizzes example, scale
  await page.selectOption("select", { label: "Quizzes example, open" })

  // Click input[type="text"]
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-open-empty",
    waitForThisToBeVisibleAndStable: [
      `text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`,
      `text="Date formats"`,
    ],
    frame,
  })

  if (!frame) {
    throw new Error("Could not find frame")
  }

  // Fill input[type="text"]
  await frame.fill(
    'input:below(:text("Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."))',
    "2024",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-open-invalid",
    waitForThisToBeVisibleAndStable: [
      `text="The answer does not match the answer format specified for this exercise."`,
      `text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`,
      `text="Date formats"`,
    ],
    frame,
  })

  // Fill input[type="text"]
  await frame.fill(
    'input:below(:text("Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."))',
    "2024-02-29",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-open-valid",
    waitForThisToBeVisibleAndStable: [
      `text="Enter the date of the next leap day in ISO 8601 format (YYYY-MM-DD)."`,
      `text="Date formats"`,
    ],
    frame,
  })
})
