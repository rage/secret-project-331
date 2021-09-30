import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, essay", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Click div[role="button"]:has-text("")
  await page.click('div[role="button"]:has-text("​")')

  // Click text=Quizzes example, scale
  await page.click("text=Quizzes example, essay")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/exercise?width=500")
    }),
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-essay",
    waitForThisToBeVisibleAndStable: [`text="Of the lamps of Fëanor"`],
    frame,
  })
})

test("widget, essay with an answer", async ({ page, headless }) => {
  // Go to http://project-331.local/playground
  await page.goto("http://project-331.local/playground")

  // Click div[role="button"]:has-text("")
  await page.click('div[role="button"]:has-text("​")')

  // Click text=Quizzes example, scale
  await page.click("text=Quizzes example, essay")

  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/exercise?width=500")
    }),
  )

  await frame.fill(
    `textarea:below(:text("Word count"))`,
    "I think I enrolled in the wrong course XD",
  )

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-essay-answered",
    waitForThisToBeVisibleAndStable: [`text="Of the lamps of Fëanor"`],
    frame,
  })
})
