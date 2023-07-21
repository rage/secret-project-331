import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Resetting teacher's own progress resets points", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Mathematics and Statistics" })
    .click()
  await page.getByRole("link", { name: "Navigate to course 'Reset progress'" }).click()
  await selectCourseInstanceIfPrompted(page)
  await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await page.getByRole("link", { name: "2 Page 2" }).click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"] >> nth=0')
    .getByRole("checkbox", { name: "b" })
    .click()
  await page.getByRole("button", { name: "Submit" }).first().click()
  await page.getByText("Good job!").waitFor()
  await page.getByText("Points:1/1").waitFor()
  await page.getByRole("navigation", { name: "Navigation menu" }).click()
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "Manage course" }).click()
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.getByRole("button", { name: "Reset my own progress on the course" }).click()
  await page.getByText("Successfully deleted").click()
  await page.goto(
    "http://project-331.local/org/uh-mathstat/courses/reset-progress/chapter-1/page-2",
  )
  await page.getByText("Points:0/1").first().waitFor()
  await page.getByText("Points:1/1").waitFor({ state: "hidden" })
  await page.getByRole("button", { name: "try again" }).waitFor({ state: "hidden" })
})
