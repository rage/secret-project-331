import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, checkbox", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Click div[role="button"]:has-text("")
  await page.click('div[role="button"]:has-text("​")')

  // Click text=Quizzes, example, checkbox
  await page.click("text=Quizzes, example, checkbox")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/exercise?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-checkbox",
    waitForThisToBeVisibleAndStable: `text="The s in https stands for secure."`,
    frame,
  })
})
