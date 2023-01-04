import { test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("exam list renders, can create exam", async ({ headless, page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click(
      '[aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  await page.locator("text=Exams").nth(1).click()

  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "exam-listing",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Exams")],
    beforeScreenshot: () => page.locator("text=Exams").nth(1).scrollIntoViewIfNeeded(),
  })

  await page.locator("text=ManageCre >> button").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=new-exam-dialog"),
    headless,
    snapshotName: "create-exam-dialog",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Name"),
      page.locator("text=Starts at"),
      page.locator("text=Ends at"),
      page.locator("text=Time in minutes"),
      page.locator("text=duplicate"),
    ],
  })

  // Fill [label="Name"]
  await page.locator('[label="Name"]').fill("new exam")

  // Fill [label="starts\ at"]
  await page.locator('[label="Starts\\ at"]').fill("2099-11-11T13:15")

  // Fill [label="starts\ at"]
  await page.locator('[label="Ends\\ at"]').fill("2099-11-12T13:15")

  // Fill [label="Time\ in\ minutes"]
  await page.locator('[label="Time\\ in\\ minutes"]').fill("120")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=new-exam-dialog"),
    headless,
    snapshotName: "create-exam-dialog-filled",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Name"),
      page.locator("text=Starts at"),
      page.locator("text=Ends at"),
      page.locator("text=Time in minutes"),
      page.locator("text=duplicate"),
    ],
  })

  await page.locator("text=Submit").click()
})
