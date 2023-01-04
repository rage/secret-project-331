import { test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("course list renders", async ({ headless, page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click(
      '[aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")
  await expectScreenshotsToMatchSnapshots({
    headless,
    screenshotTarget: page,
    snapshotName: "course-listing",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Courses:")],
  })
})
