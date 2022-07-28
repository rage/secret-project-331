import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, checkbox", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Click text=Quizzes, example, checkbox
  await page.selectOption("select", { label: "Quizzes, example, checkbox" })

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-checkbox-initial",
    waitForThisToBeVisibleAndStable: `text="The s in https stands for secure."`,
    frame,
  })

  if (!frame) {
    throw new Error("Could not find frame")
  }

  // Check input[type="checkbox"]
  await frame.check('input[type="checkbox"]')

  // Check :nth-match(input[type="checkbox"], 2)
  await frame.check(':nth-match(input[type="checkbox"], 2)')

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-checkbox-both-checked",
    waitForThisToBeVisibleAndStable: `text="The s in https stands for secure."`,
    frame,
  })

  // Uncheck :nth-match(input[type="checkbox"], 2)
  await frame.uncheck(':nth-match(input[type="checkbox"], 2)')

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-checkbox-other-unchecked",
    waitForThisToBeVisibleAndStable: `text="The s in https stands for secure."`,
    frame,
  })
})
