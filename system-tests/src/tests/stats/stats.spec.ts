import { test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Can visit the stats page", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "Manage course 'Introduction to localizing'" }).click()
  await page.getByRole("tab", { name: "Stats" }).click()
  await page.getByRole("heading", { name: "Students started the course" }).waitFor()
  await page.getByRole("heading", { name: "Students Starting the Course" }).waitFor()
  await page.getByRole("heading", { name: "Course Completions" }).waitFor()
  await page.getByRole("tab", { name: "User activity" }).click()
  await page.getByRole("heading", { name: "Users with submissions by day" }).waitFor()
  await page.getByRole("tab", { name: "Visitors" }).click()
  await page.getByRole("heading", { name: "Course Visitors" }).waitFor()
  await page.getByRole("tab", { name: "Course instances" }).nth(1).click()
  await page.getByRole("cell", { name: "Default instance" }).waitFor()
  await page.getByRole("heading", { name: "Students Starting the Course" }).waitFor()
})
