import { BrowserContext, expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

let context1: BrowserContext
let context2: BrowserContext
let context3: BrowserContext

test.beforeEach(async ({ browser }) => {
  context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
  context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
  context3 = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
})

test.afterEach(async () => {
  await context1.close()
  await context2.close()
  await context3.close()
})

test("Grade exams > Exam submissions", async ({}) => {
  test.slow()
  const student1Page = await context1.newPage()
  const student2Page = await context2.newPage()
  const teacherPage = await context3.newPage()

  // Student1 goes to the exam page and submits answers
  await student1Page.goto(
    "http://project-331.local/org/uh-cs/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c",
  )

  student1Page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await student1Page.getByRole("button", { name: "Start the exam!" }).click()

  await student1Page
    .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
    .getByRole("button", { name: "cargo" })
    .click()
  await student1Page
    .getByLabel("Exercise:Multiple choice with")
    .getByRole("button", { name: "Submit" })
    .click()
  await student1Page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await student1Page
    .getByLabel("Exercise:Best exercise")
    .getByRole("button", { name: "Submit" })
    .click()

  // Student2 goes to the exampage and submits answers
  await student2Page.goto(
    "http://project-331.local/org/uh-cs/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c",
  )

  student2Page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await student2Page.getByRole("button", { name: "Start the exam!" }).click()

  await student2Page
    .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
    .getByRole("button", { name: "npm" })
    .click()
  await student2Page
    .getByLabel("Exercise:Multiple choice with")
    .getByRole("button", { name: "Submit" })
    .click()
  await student2Page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "a" })
    .click()
  await student2Page
    .getByLabel("Exercise:Best exercise")
    .getByRole("button", { name: "Submit" })
    .click()

  // Teacher goes to grading page and grades the students submissions

  await teacherPage.goto("http://project-331.local/organizations")
  await teacherPage.getByLabel("University of Helsinki, Department of Computer Science").click()
  await teacherPage
    .locator("li")
    .filter({ hasText: "Ongoing short timerManage" })
    .getByRole("link")
    .nth(1)
    .click()
  await teacherPage.getByRole("link", { name: "Grading" }).click()

  // Check that there are both students submissions
  await expect(teacherPage.getByRole("cell", { name: "Number of answered" })).toBeVisible()
  await expect(teacherPage.getByRole("cell", { name: "2" }).first()).toBeVisible()

  await teacherPage.getByRole("row", { name: "Grade Question 1" }).getByRole("button").click()

  // Check the first submissions has 0 points and it's ungraded
  await expect(teacherPage.getByText("Ungraded").first()).toBeVisible()
  await expect(teacherPage.getByText("0/ 1").first()).toBeVisible()

  // Grade both submissions
  await teacherPage
    .getByRole("row", { name: "Grade 02364d40-2aac-4763-8a06" })
    .getByRole("button")
    .click()
  await teacherPage.locator("#Justification").fill("Ok")
  await teacherPage.getByRole("textbox", { name: "undefinedfalse" }).fill("1")
  await teacherPage.getByRole("button", { name: "Save and next" }).click()

  // TO DO make page actually wait fot tis notification
  // await teacherPage.getByText("Operation successful!").waitFor()

  await teacherPage.locator("#Justification").fill("Good")
  await teacherPage.getByRole("textbox", { name: "undefinedfalse" }).fill("0.5")
  await teacherPage.getByRole("button", { name: "Submit" }).click()
  await teacherPage.getByText("Operation successful!").waitFor()

  // Check both submissions are graded
  await teacherPage.getByRole("link", { name: "Submissions" }).click()
  await expect(teacherPage.getByText("Graded").first()).toBeVisible()
  await expect(teacherPage.getByRole("cell", { name: "1/ 1" }).first()).toBeVisible()
  await expect(teacherPage.getByText("Graded").nth(1)).toBeVisible()
  await expect(teacherPage.getByRole("cell", { name: "0.5/" })).toBeVisible()

  await teacherPage.getByRole("link", { name: "Questions" }).click()

  // Check question 1 is fully graded and unpublished
  await expect(teacherPage.getByText("Graded", { exact: true })).toBeVisible()
  await expect(
    teacherPage.getByRole("row", { name: "Grade Question 1 Graded 2 2 2" }),
  ).toBeVisible()
  await expect(teacherPage.getByText("You have 2 unpublished grading results")).toBeVisible()

  // Publish grading results
  teacherPage.once("dialog", (dialog) => {
    dialog.accept()
  })

  await teacherPage.getByRole("button", { name: "Publish grading results" }).click()
  await teacherPage.getByText("Operation successful!").waitFor()

  await expect(
    teacherPage.getByRole("row", { name: "Grade Question 1 Graded 2 2 0" }),
  ).toBeVisible()

  //Both students check that they can see grading results after the teacher published them

  await student1Page.goto(
    "http://project-331.local/org/uh-cs/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c",
  )

  await expect(student1Page.getByText("Exercise name: Best exercise")).toBeVisible()
  await expect(student1Page.getByText("Feedback: Ok")).toBeVisible()
  await expect(student1Page.getByText("Points: 1")).toBeVisible()

  await student2Page.goto(
    "http://project-331.local/org/uh-cs/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c",
  )
  await expect(student2Page.getByText("Exercise name: Best exercise")).toBeVisible()
  await expect(student2Page.getByText("Feedback: Good")).toBeVisible()
  await expect(student2Page.getByText("Points: 0.5")).toBeVisible()
})
