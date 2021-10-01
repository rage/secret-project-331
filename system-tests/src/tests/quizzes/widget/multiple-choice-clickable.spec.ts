import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice-clickable screenshot test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=University of Helsinki, Department of Computer Science

  await page.click('div[role="button"]:has-text("​")')
  // Click text=Quizzes example, multiple-choice
  await page.click("text=Quizzes example, multiple-choice clickable")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/exercise?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-clickable",
    waitForThisToBeVisibleAndStable: `text="Choose your favorite colors"`,
    frame,
  })
})

test("widget, multiple-choice-clickable screenshot test, answered", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/playground")

  // Click text=University of Helsinki, Department of Computer Science

  await page.click('div[role="button"]:has-text("​")')
  // Click text=Quizzes example, multiple-choice
  await page.click("text=Quizzes example, multiple-choice clickable")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/exercise?width=500")
    }),
  )

  await frame.click("text=Cyan")
  await frame.click("text=Sienna")
  await frame.click("text=LawnGreen")

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-clickable-answered",
    waitForThisToBeVisibleAndStable: `text="Choose your favorite colors"`,
    frame,
  })
})
