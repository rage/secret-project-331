import { test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

import { selectOrganization } from "@/utils/organizationUtils"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("course list renders", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    await selectOrganization(page, "University of Helsinki, Department of Computer Science"),
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
