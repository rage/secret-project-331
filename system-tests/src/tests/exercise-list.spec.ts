import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Exercise list works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Advanced exercise states'" }).click()
  await page.getByRole("tab", { name: "Exercises" }).click()
  await page.getByRole("heading", { name: "Manage exercise repositories" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "exercise-list-view",

    waitForTheseToBeVisibleAndStable: [page.locator("text=Exercises in this course")],
  })
})
