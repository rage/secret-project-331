import { BrowserContext, test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

let context1: BrowserContext
let context2: BrowserContext

test.beforeEach(async ({ browser }) => {
  context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
  context2 = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
})

test.afterEach(async () => {
  await context1.close()
  await context2.close()
})

test("Exercise setup changes between users tries", async () => {
  const student1Page = await context1.newPage()
  const teacherPage = await context2.newPage()

  // set tries to 2 on exercise slide
  await teacherPage.goto("http://project-331.local/")
  await teacherPage.getByRole("button", { name: "Open menu" }).click()
  await teacherPage.getByRole("button", { name: "Open menu" }).click()
  await teacherPage
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await teacherPage.getByRole("link", { name: "Manage course 'Advanced exercise states'" }).click()
  await teacherPage.getByRole("tab", { name: "Pages" }).click()
  await teacherPage
    .getByRole("row", {
      name: "Multiple choice with feedback /chapter-1/the-multiple-choice-with-feedback Edit page Dropdown menu",
    })
    .getByRole("button", { name: "Edit page" })
    .click()
  await teacherPage.getByLabel("Limit number of tries").check()
  await teacherPage.getByPlaceholder("Max tries per slide").click()
  await teacherPage.getByPlaceholder("Max tries per slide").fill("2")
  await teacherPage.getByRole("button", { name: "Save", exact: true }).click()

  // Student navigates to page and answers the exercise
  await student1Page.goto("http://project-331.local/")
  await student1Page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await student1Page
    .getByRole("link", { name: "Navigate to course 'Advanced exercise states'" })
    .click()
  await student1Page.getByText("Default", { exact: true }).click()
  await student1Page.getByTestId("select-course-instance-continue-button").click()
  await student1Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await student1Page.getByRole("link", { name: "9 Multiple choice with feedback" }).click()
  await student1Page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("button", { name: "rustup" })
    .click()

  await student1Page.getByRole("button", { name: "Submit" }).click()

  // Teacher adds a task to exercise
  await teacherPage.goto("http://project-331.local/")
  await teacherPage
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await teacherPage.getByRole("link", { name: "Manage course 'Advanced exercise states'" }).click()
  await teacherPage.getByRole("tab", { name: "Pages" }).click()
  await teacherPage
    .getByRole("row", {
      name: "Multiple choice with feedback /chapter-1/the-multiple-choice-with-feedback Edit page Dropdown menu",
    })
    .getByRole("button", { name: "Edit page" })
    .click()
  await teacherPage.getByRole("button", { name: "Add task" }).click()
  await teacherPage.getByRole("button", { name: "Edit" }).nth(1).click()
  await teacherPage.getByRole("button", { name: "Quizzes" }).click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Multiple choice Choose correct answer from list of options" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Title", { exact: true })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Title", { exact: true })
    .fill("new task")
  // Scroll a little bit down
  await teacherPage.evaluate(() => window.scrollBy(0, 500))
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Add option" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Add option" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Add option" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Option 1" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .fill("false")
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Close" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Option 2" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Correct", { exact: true })
    .check()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .fill("true")
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Close" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Option 3" })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .click()
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByLabel("Option title", { exact: true })
    .fill("false")
  await teacherPage
    .frameLocator('iframe[title="IFRAME EDITOR"]')
    .getByRole("button", { name: "Close" })
    .click()
  await teacherPage.getByRole("button", { name: "Save", exact: true }).click()

  // Student tries again
  await student1Page.reload()
  await student1Page.getByRole("button", { name: "try again" }).click()
  await student1Page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("button", { name: "cargo" })
    .click()
  await student1Page
    .frameLocator('iframe[title="Exercise 1\\, task 2 content"]')
    .getByRole("button", { name: "true" })
    .click()
  await student1Page.getByRole("button", { name: "Submit" }).click()
})
