import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.describe("An exercise that has self review but no peer review works", () => {
  let context1: BrowserContext
  let context2: BrowserContext

  test.beforeEach(async ({ browser }) => {
    ;[context1, context2] = await Promise.all([
      browser.newContext({ storageState: "src/states/teacher@example.com.json" }),
      browser.newContext({ storageState: "src/states/student1@example.com.json" }),
    ])
  })

  test("An exercise that has self review but no peer review works", async () => {
    const teacherPage = await context1.newPage()
    const student1Page = await context2.newPage()

    await test.step("Teacher configures an exercise that has a self review using the inline editor", async () => {
      await teacherPage.goto("http://project-331.local/")
      await teacherPage.getByRole("link", { name: "All organizations" }).click()
      await teacherPage
        .getByLabel("University of Helsinki, Department of Mathematics and Statistics")
        .click()
      await teacherPage.getByLabel("Manage course 'Self review'").click()
      await teacherPage.getByRole("tab", { name: "Pages" }).click()
      await teacherPage
        .getByRole("row", { name: "Multiple choice with feedback" })
        .getByRole("button")
        .first()
        .click()
      await teacherPage.getByText("Peer and self review").click()
      await teacherPage.getByText("Add self review").click()
      await teacherPage.getByText("Use course default peer").click()
      await teacherPage.getByLabel("Add default block").click()
      await teacherPage
        .getByLabel("Empty block; start writing or")
        .fill("In this review, you have to do x.")
      await teacherPage.getByRole("button", { name: "Add peer review question" }).click()
      await teacherPage.getByRole("button", { name: "Add peer review question" }).click()
      await teacherPage.getByLabel("Peer review questionInsert").click()
      await teacherPage.getByLabel("Peer review questionInsert").fill("General feedback")
      await teacherPage.getByRole("button", { name: "Add peer review question" }).click()
      await teacherPage.getByLabel("Peer review question type").nth(1).selectOption("Scale")
      await teacherPage.getByLabel("Peer review questionInsert").click({
        clickCount: 3,
      })
      await teacherPage.getByLabel("Peer review questionInsert").fill("The answer was correct")
      await teacherPage.getByRole("button", { name: "Save", exact: true }).click()
      await teacherPage.getByText("Operation successful!").waitFor()
    })

    await test.step("Student 1 answers the exercise and reviews their own answer", async () => {
      await student1Page.goto(
        "http://project-331.local/org/uh-mathstat/courses/self-review/chapter-1/the-multiple-choice-with-feedback",
      )
      await selectCourseInstanceIfPrompted(student1Page)
      await student1Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByRole("button", { name: "cargo" })
        .click()
      await student1Page.getByRole("button", { name: "Submit" }).click()
      await student1Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByText("Your answer was correct.")
        .waitFor()
      await student1Page.getByRole("button", { name: "Start self review" }).click()
      await student1Page.getByText("In this review, you have to do x.").waitFor()
      await student1Page
        .getByPlaceholder("Write a review")
        .fill("This was such a good answer 100/100.")
      await student1Page
        .locator("div")
        .filter({ hasText: /^Agree$/ })
        .locator("ellipse")
        .first()
        .click()
      await student1Page.getByRole("button", { name: "Submit" }).click()
      await student1Page.getByText("Operation successful!").waitFor()
      await student1Page.getByText("Waiting for course staff to review your answer").waitFor()
    })
    await test.step(`Teacher reviews the answer`, async () => {
      await teacherPage.goto(
        "http://project-331.local/manage/courses/3cbaac48-59c4-4e31-9d7e-1f51c017390d/pages",
      )
      await teacherPage.getByRole("tab", { name: "Exercises" }).click()
      await teacherPage.getByRole("link", { name: "View answers requiring" }).click()
      await teacherPage.getByRole("button", { name: "Custom points" }).click()
      await teacherPage.getByRole("slider").fill("0.7")
      await teacherPage.getByRole("button", { name: "Give custom points" }).click()
      await teacherPage.getByText("Operation successful!").waitFor()
    })

    await test.step("Student 1 sees the results", async () => {
      await student1Page.reload()
      await expect(student1Page.getByTestId("exercise-points")).toContainText("0.7/1")
      await student1Page.getByText("Your answer has been reviewed").waitFor()
    })
  })
})
