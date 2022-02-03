import { test } from "@playwright/test"

import expectPath from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("course list renders", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click(
      '[aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  expectPath(page, "/org/uh-cs")
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "course-listing",
    waitForThisToBeVisibleAndStable: ["text=Courses:"],
  })
})
