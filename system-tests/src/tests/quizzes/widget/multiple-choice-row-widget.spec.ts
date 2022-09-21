import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice row screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=University of Helsinki, Department of Computer Science

  // Click text=Quizzes example, multiple-choice
  await page.selectOption("select", { label: "Quizzes example, multiple-choice, row" })

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
    snapshotName: "widget-multiple-choice-row-initial",
    waitForThisToBeVisibleAndStable: `text="Which of the color codes represent the color"`,
    frame,
  })

  // Click text=#00ff00
  await frame.click("text=#00ff00")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-row-#00ff00",
    waitForThisToBeVisibleAndStable: `text="Which of the color codes represent the color"`,
    frame,
  })

  // Click text=#ff0000
  await frame.click("text=#ff0000")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-row-#ff0000",
    waitForThisToBeVisibleAndStable: `text="Which of the color codes represent the color"`,
    frame,
  })
})
