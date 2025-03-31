import { test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "@/utils/expect"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("course list renders", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.click(
      '[aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")
  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "course-listing",
    waitForTheseToBeVisibleAndStable: [page.getByText("Courses:")],
  })
})
