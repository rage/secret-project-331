import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("glossary-tooltip", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/org/uh-cs/courses/glossary-tooltip/tooltip")

  // -- Select default course instance
  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "glossary-tooltips",
    beforeScreenshot: async () => {
      await page.getByText("KBKeyboard.").hover()
    },
  })
})
