import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice multi screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=University of Helsinki, Department of Computer Science

  await page.click('div[role="button"]:has-text("​")')
  // Click text=Quizzes example, multiple-choice
  await page.click("text=Quizzes example, multiple-choice, multi")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/exercise?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-multi-initial",
    waitForThisToBeVisibleAndStable: `text="Which of the color codes represent the color"`,
    frame,
  })

  // Click text=#00ff00
  await frame.click("text=#00ff00")
  await frame.click("text=#ff0000")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-multi-answered",
    waitForThisToBeVisibleAndStable: `text="Which of the color codes represent the color"`,
    frame,
  })
})
