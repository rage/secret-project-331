import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Testing exam works", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
  await page.getByLabel("University of Helsinki, Department of Computer Science").click()
  //Create exam
  await page.getByRole("button", { name: "Create" }).nth(1).click()
  await page.getByLabel("Name", { exact: true }).fill("Exam for testing")
  await page.getByLabel("Starts at").fill("1990-12-03T12:00")
  await page.getByLabel("Ends at").fill("2052-03-09T09:08:01")
  await page.getByLabel("Time in minutes", { exact: true }).fill("60")
  await page.getByRole("button", { name: "Submit" }).click()

  await page
    .locator("li")
    .filter({ hasText: "Exam for testingManage" })
    .getByRole("link")
    .nth(1)
    .click()

  //Add exercise to exam
  await page.getByRole("link", { name: "Manage page" }).click()

  await page.getByLabel("Toggle view").selectOption("block-menu")
  await page.getByRole("option", { name: "Exercise", exact: true }).click()
  await page.getByPlaceholder("Exercise name").fill("Exercise name")

  await page.getByRole("button", { name: "Add slide" }).click()
  await page.getByRole("button", { name: "Add task" }).click()
  await page.getByLabel("Edit").click()
  await page.getByRole("button", { name: "Quizzes" }).click()
  await page
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Multiple choice Choose" })
    .click()
  await page
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Title", { exact: true })
    .fill("Multiple choice")
  await page
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .fill("Correct answer")
  await page.frameLocator('iframe[title="IFRAME EDITOR"]').getByLabel("Correct").check()
  await page
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Add option" })
    .click()
  await page
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .fill("Wrong answer")
  await page
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Add option" })
    .click()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByText("Success", { exact: true }).click()

  await page.goto("http://project-331.local/organizations")
  await page.getByLabel("University of Helsinki, Department of Computer Science").click()
  await page
    .locator("li")
    .filter({ hasText: "Exam for testingManage" })
    .getByRole("link")
    .nth(1)
    .click()

  //Test exam
  await page.getByRole("link", { name: "Test exam", exact: true }).click()
  page.on("dialog", (dialog) => dialog.accept())
  await page.locator(`button:text("Start the exam!")`).click()

  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("button", { name: "Correct answer" })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()

  //Show exercise answers
  await page.getByLabel("show answers").check()
  await expect(
    page
      .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
      .getByText("Your answer was correct."),
  ).toBeVisible()

  //Hide exercise answers
  await page.getByLabel("show answers").uncheck()
  await expect(
    page
      .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
      .getByText("Your answer was correct."),
  ).toBeHidden()

  //Reset exam progress
  await page.getByRole("button", { name: "Reset" }).click()
  await page.getByRole("button", { name: "Submit" }).isDisabled()

  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("button", { name: "Correct answer" })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Your submission has been").isVisible()
  await page.getByText("Show answers").click()
  await expect(
    page
      .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
      .getByText("Your answer was correct."),
  ).toBeVisible()
})
