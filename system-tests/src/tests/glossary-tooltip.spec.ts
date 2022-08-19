import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("glossary-tooltip", async ({ page, headless }) => {
  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-tooltip/tooltip")

  // -- Select default course instance
  // Click text=Default >> nth=0
  await page.locator("text=Default").first().click()
  // Click button:has-text("Continue")
  await page.locator('button:has-text("Continue")').click()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "glossary-tooltips",
    beforeScreenshot: async () => {
      await page.locator("text=KB Keyboard.").hover()
    },
    toMatchSnapshotOptions: { threshold: 0.4 },
  })
})
