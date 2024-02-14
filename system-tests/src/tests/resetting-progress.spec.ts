import { BrowserContext, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Resetting teacher's own progress resets points", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
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
  // await page.getByText("Points:1/1").waitFor()
  await page.waitForSelector('div.points:has-text("1⁄1")')
  await page.getByRole("navigation", { name: "Navigation menu" }).click()
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "Manage course" }).click()
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.getByRole("button", { name: "Reset my own progress on the course" }).click()
  await page.getByText("Successfully deleted").waitFor()
  await page.goto(
    "http://project-331.local/org/uh-mathstat/courses/reset-progress/chapter-1/page-2",
  )
  await page.getByText("0⁄1").first().waitFor()
  await page.getByText("1⁄1").waitFor({ state: "hidden" })
  await page.getByRole("button", { name: "try again" }).waitFor({ state: "hidden" })
})

test("Teacher can reset progress for all students on draft courses", async ({ page, browser }) => {
  let studentContext: BrowserContext | null = null
  try {
    studentContext = await browser.newContext({
      storageState: "src/states/student1@example.com.json",
    })
    const studentPage = await studentContext.newPage()
    await studentPage.goto("http://project-331.local/organizations")
    await studentPage
      .getByRole("link", {
        name: "University of Helsinki, Department of Mathematics and Statistics",
      })
      .click()
    await studentPage.getByRole("link", { name: "Navigate to course 'Reset progress'" }).click()
    await selectCourseInstanceIfPrompted(studentPage)
    await studentPage.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await studentPage.getByRole("link", { name: "2 Page 2" }).click()
    await studentPage
      .frameLocator('iframe[title="Exercise 1\\, task 1 content"] >> nth=0')
      .getByRole("checkbox", { name: "b" })
      .click()
    await studentPage.getByRole("button", { name: "Submit" }).first().click()
    await studentPage.getByText("Good job!").waitFor()
    await studentPage.getByText("1⁄1").waitFor()
    await page.goto("http://project-331.local/org/uh-mathstat")
    await page.locator(`[aria-label="Manage course 'Reset progress'"]`).click()

    await page
      .getByRole("button", {
        name: "Reset my own progress on the course",
      })
      .waitFor()
    // The course is not a draft course so there should be no button to reset progress for all students
    await page
      .getByRole("button", {
        name: "Reset progress for all students on the course (works only on draft courses)",
      })
      .waitFor({ state: "hidden" })

    // Chang the course to a draft course
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await page.getByLabel("Draft").check()
    await page.getByRole("button", { name: "Update", exact: true }).click()
    await page.getByRole("heading", { name: "Reset progress (Draft)" }).waitFor()

    page.once("dialog", (dialog) => {
      dialog.accept()
    })
    await page
      .getByRole("button", {
        name: "Reset progress for all students on the course (works only on draft courses)",
      })
      .click()
    await page.getByText("Successfully deleted").waitFor()
    // Change the course back to a non-draft course so that the student can access it
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await page.getByLabel("Draft").uncheck()
    await page.getByRole("button", { name: "Update", exact: true }).click()
    await page.getByRole("heading", { name: "Reset progress (Draft)" }).waitFor({ state: "hidden" })

    // After this the student should not have any points
    await studentPage.goto(
      "http://project-331.local/org/uh-mathstat/courses/reset-progress/chapter-1/page-2",
    )
    await studentPage.getByText("0⁄1").first().waitFor()
    await studentPage.getByText("1⁄1").waitFor({ state: "hidden" })
    await studentPage.getByRole("button", { name: "try again" }).waitFor({ state: "hidden" })
  } finally {
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (studentContext !== null) {
      await studentContext.close()
    }
  }
})
