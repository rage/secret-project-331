import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/teaching-and-learning-services@example.com.json",
})

test("User search works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Search users" }).click()
  await page.getByLabel("Email, name or user id", { exact: true }).click()
  await page.getByLabel("Email, name or user id", { exact: true }).fill("notexisting")
  await page.getByLabel("Email, name or user id", { exact: true }).press("Enter")
  await page.getByText("No users found").first().waitFor()
  await page.getByLabel("Email, name or user id", { exact: true }).click()
  await page.getByLabel("Email, name or user id", { exact: true }).fill("language.teacher")
  await page.getByRole("button", { name: "Search" }).click()
  await page.getByText(/users? found$/).waitFor()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    testInfo,
    headless,
    snapshotName: "search-results",
    beforeScreenshot: () => page.getByRole("progressbar").waitFor({ state: "hidden" }),
  })
  await page.getByLabel("Email, name or user id", { exact: true }).fill("user@example.com")
  await page.getByRole("button", { name: "Search" }).click()
  await page.getByRole("link", { name: /user_1@example\.com/ }).click()
  const courseCard = page
    .getByTestId("course-status-card")
    .filter({ hasText: "Introduction to feedback" })
    .first()
  await courseCard.waitFor()
  // The card body (with the "Course status summary" link) is inside a collapsed Disclosure; expand it
  // via its trigger (the course name leads its accessible name), then follow the now-visible link.
  await courseCard.getByRole("button", { name: /Introduction to feedback/ }).click()
  await courseCard.getByRole("link", { name: "Course status summary" }).click()
  await page.getByText("5 submissions").first().waitFor()
})
