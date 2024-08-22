import { BrowserContext, expect, test } from "@playwright/test"

import { scrollLocatorsParentIframeToViewIfNeeded } from "@/utils/iframeLocators"

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

test("Grade exams manually", async ({}) => {
  test.slow()
  const student1Page = await context1.newPage()
  const student2Page = await context2.newPage()
  const teacherPage = await context3.newPage()

  // Student1 goes to the exam page and submits answers and then ends exam
  await student1Page.goto(
    "http://project-331.local/org/uh-cs/exams/fee8bb0c-8629-477c-86eb-1785005143ae",
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
  await student1Page.getByRole("button", { name: "Try again" }).waitFor()
  await scrollLocatorsParentIframeToViewIfNeeded(
    student1Page
      .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
      .getByRole("checkbox", { name: "b" }),
  )
  await student1Page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await student1Page.getByRole("button", { name: "Submit" }).click()
  await student1Page.getByRole("button", { name: "Try again" }).nth(1).waitFor()

  student1Page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await student1Page.getByRole("button", { name: "End exam" }).click()
  await expect(student1Page.getByText("Success", { exact: true })).toBeVisible()

  // Student2 goes to the exam page and submits answers and then ends exam
  await student2Page.goto(
    "http://project-331.local/org/uh-cs/exams/fee8bb0c-8629-477c-86eb-1785005143ae",
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
  await student2Page.getByRole("button", { name: "Try again" }).waitFor()
  await scrollLocatorsParentIframeToViewIfNeeded(
    student2Page
      .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
      .getByRole("checkbox", { name: "b" }),
  )
  await student2Page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await student2Page.getByRole("button", { name: "Submit" }).click()
  await student2Page.getByRole("button", { name: "Try again" }).nth(1).waitFor()

  student2Page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await student2Page.getByRole("button", { name: "End exam" }).click()
  await expect(student2Page.getByText("Success", { exact: true })).toBeVisible()

  // Teacher goes to the grading page and grades the students submissions
  await teacherPage.goto("http://project-331.local/organizations")
  await teacherPage.getByLabel("University of Helsinki, Department of Computer Science").click()
  await teacherPage
    .locator("li")
    .filter({ hasText: "Exam for manual gradingManage" })
    .getByRole("link")
    .nth(1)
    .click()
  await teacherPage.getByRole("link", { name: "Grading", exact: true }).click()

  // Check that there are both students submissions
  await teacherPage.getByRole("cell", { name: "Number of answered" }).waitFor()
  await expect(teacherPage.getByRole("cell", { name: "2" }).first()).toBeVisible()

  await teacherPage.getByRole("row", { name: "Grade Question 1" }).getByRole("button").click()

  // Check the first submissions has 0 points and it's ungraded
  await expect(teacherPage.getByRole("cell", { name: "Ungraded" }).first()).toBeVisible()
  await expect(teacherPage.getByText("0/ 1").first()).toBeVisible()

  // Grade both submissions
  await teacherPage
    .getByRole("row", { name: "Grade 02364d40-2aac-4763-8a06" })
    .getByRole("button")
    .click()
  await teacherPage.locator("#Justification").fill("Ok")
  await teacherPage.getByLabel("Score", { exact: true }).fill("1")
  await teacherPage.getByRole("button", { name: "Save and next" }).click()

  await teacherPage.locator("#Justification").fill("Good")
  await teacherPage.getByLabel("Score", { exact: true }).fill("0.5")
  await teacherPage.getByRole("button", { name: "Submit" }).click()
  await teacherPage.getByText("Operation successful!").waitFor()

  // Check both submissions are graded
  await teacherPage.getByRole("link", { name: "Submissions" }).click()
  await expect(teacherPage.getByText("Graded").first()).toBeVisible()
  await expect(teacherPage.getByRole("cell", { name: "1/ 1" }).first()).toBeVisible()
  await expect(teacherPage.getByText("Graded").nth(1)).toBeVisible()
  await expect(teacherPage.getByRole("cell", { name: "0.5/ 1" })).toBeVisible()

  await teacherPage.getByRole("link", { name: "Questions" }).click()

  // Check question 1 is fully graded and unpublished
  await expect(teacherPage.getByText("Graded", { exact: true })).toBeVisible()
  await expect(
    teacherPage.getByRole("row", { name: "Grade Question 1 Graded 2 2 2" }),
  ).toBeVisible()
  await expect(teacherPage.getByText("You have 2 unpublished grading results")).toBeVisible()

  // Check students can't see grading results before they are published
  await student1Page.goto(
    "http://project-331.local/org/uh-cs/exams/fee8bb0c-8629-477c-86eb-1785005143ae",
  )
  await expect(
    student1Page.getByText("Your time has run out and the exam is now closed"),
  ).toBeVisible()

  await student2Page.goto(
    "http://project-331.local/org/uh-cs/exams/fee8bb0c-8629-477c-86eb-1785005143ae",
  )
  await expect(
    student2Page.getByText("Your time has run out and the exam is now closed"),
  ).toBeVisible()

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
    "http://project-331.local/org/uh-cs/exams/fee8bb0c-8629-477c-86eb-1785005143ae",
  )

  await expect(student1Page.getByText("Name: Best exercise")).toBeVisible()
  await expect(student1Page.getByText("Points: 1 / 1")).toBeVisible()
  await expect(student1Page.getByText("Feedback:Ok")).toBeVisible()

  await student2Page.goto(
    "http://project-331.local/org/uh-cs/exams/fee8bb0c-8629-477c-86eb-1785005143ae",
  )
  await expect(student2Page.getByText("Name: Best exercise")).toBeVisible()
  await expect(student2Page.getByText("Points: 0.5 / 1")).toBeVisible()
  await expect(student2Page.getByText("Feedback:Good")).toBeVisible()
})
