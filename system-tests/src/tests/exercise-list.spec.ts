import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }) => {
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Advanced exercise states'" }).click()
  await page.getByRole("tab", { name: "Exercises" }).click()
  await page.getByRole("heading", { name: "Manage exercise repositories" }).click()
  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "exercise-list-view",

    waitForThisToBeVisibleAndStable: "text=Exercises in this course",
  })
})
