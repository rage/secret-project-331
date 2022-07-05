import { test } from "@playwright/test"

import expectPath from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("exam list renders, can create exam", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click(
      '[aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  await page.click("text=Exams")

  expectPath(page, "/org/uh-cs")
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "exam-listing",
    waitForThisToBeVisibleAndStable: ["text=Exams"],
    beforeScreenshot: () => page.locator("text=Exams").scrollIntoViewIfNeeded(),
  })

  // Click text=Ongoing ends soonManageOngoing short timerManageStarting soonManageOverManageCre >> button
  await page.locator("text=OverManageCre >> button").click()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "create-exam-dialog",
    elementId: "#new-exam-dialog",
    waitForThisToBeVisibleAndStable: [
      "text=Name",
      "text=Starts at",
      "text=Ends at",
      "text=Time in minutes",
      "text=duplicate",
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
    page,
    headless,
    snapshotName: "create-exam-dialog-filled",
    elementId: "#new-exam-dialog",
    waitForThisToBeVisibleAndStable: [
      "text=Name",
      "text=Starts at",
      "text=Ends at",
      "text=Time in minutes",
      "text=duplicate",
    ],
  })

  // Click text=Submit
  await page.locator("text=Submit").click()
})
