import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Organization list renders", async ({ page, headless }) => {
  await page.goto("http://project-331.local/manage/exercise-services")
  await page.goto("http://project-331.local/")
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "frontpage-organizations-list",
    waitForThisToBeVisibleAndStable: "text=learn the basics in Computer Science",
  })
})
