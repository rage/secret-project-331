import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice-clickable screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=Quizzes example, multiple-choice
  await page.selectOption("select", { label: "Quizzes example, multiple-choice clickable" })

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe?width=500")
    }),
  )

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-clickable",
    waitForThisToBeVisibleAndStable: [
      `text="Choose your favorite colors"`,
      `text=Cyan`,
      `text=Sienna`,
      `text=LawnGreen`,
    ],
    frame,
  })

  await frame.click(`button:text("Cyan")`)
  await frame.click(`button:text("Sienna")`)
  await frame.click(`button:text("LawnGreen")`)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-clickable-answered",
    waitForThisToBeVisibleAndStable: [
      `text="Choose your favorite colors"`,
      `text=Cyan`,
      `text=Sienna`,
      `text=LawnGreen`,
    ],
    frame,
  })
})
