import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Exercise score updates gradually", async ({ page }) => {
  await page.goto(
    "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/complicated-exercise",
  )
  await selectCourseInstanceIfPrompted(page)
  await page.getByText("First question.").waitFor()
  await page.getByText("Second question.").waitFor()
  await page.getByText("Third question.").waitFor()
  await expect(page.getByTestId("exercise-points")).toContainText("0/3")

  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 2 content"]')
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByRole("checkbox", { name: "Incorrect" })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  await expect(page.getByTestId("exercise-points")).toContainText("2/3")

  await page.getByRole("button", { name: "Try again" }).click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "Incorrect" })
    .click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 2 content"]')
    .getByRole("checkbox", { name: "Incorrect" })
    .click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  // Points should stay the same since previous answer was more correct
  await expect(page.getByTestId("exercise-points")).toContainText("2/3")

  await page.getByRole("button", { name: "Try again" }).click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 2 content"]')
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  await expect(page.getByTestId("exercise-points")).toContainText("3/3")
})
