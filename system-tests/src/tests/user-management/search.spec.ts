import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/teaching-and-learning-services@example.com.json",
})

test("User search works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Search users" }).click()
  await page.getByLabel("User email or name", { exact: true }).click()
  await page.getByLabel("User email or name", { exact: true }).fill("notexisting")
  await page.getByLabel("User email or name", { exact: true }).press("Enter")
  await page.getByText("No results").waitFor()
  await page.getByLabel("User email or name", { exact: true }).click()
  await page.getByLabel("User email or name", { exact: true }).fill("language.teacher")
  await page.getByRole("button", { name: "Search" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    testInfo,
    headless,
    snapshotName: "search-results",
  })
  await page.getByLabel("User email or name", { exact: true }).fill("user@example.com")
  await page.getByRole("button", { name: "Search" }).click()
  await page
    .getByRole("row", {
      name: "00e249d8-345f-4eff-aedb-7bdc4c44c1d5 user_1@example.com User1 Details",
    })
    .getByRole("button", { name: "Details" })
    .click()
  await page.getByText("Course: Introduction to feedback (introduction-to-feedback)").click()
  await page.getByText("Course status summary").first().click()
  await page.getByText("5 submissions").first().waitFor()
  await page.getByRole("heading", { name: "Submissions" }).first().waitFor()
})
