import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("author-block", async ({ page, headless }, testInfo) => {
  await page.goto(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/the-authors",
  )

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "author-block",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Authors")],
    beforeScreenshot: async () => page.locator("text=Authors").scrollIntoViewIfNeeded(),
  })
})
