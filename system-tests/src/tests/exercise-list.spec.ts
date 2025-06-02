import { test } from "@playwright/test"

import { selectOrganization } from "../utils/organizationUtils"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Exercise list works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.getByRole("link", { name: "Manage course 'Advanced exercise states'" }).click()
  await page.getByRole("tab", { name: "Exercises" }).click()
  await page.getByRole("heading", { name: "Manage exercise repositories" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "exercise-list-view",

    waitForTheseToBeVisibleAndStable: [page.getByText("Exercises in this course")],
  })
})
