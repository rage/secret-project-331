import { BrowserContext, expect, test } from "@playwright/test"

import { getExerciseRegion, selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const EXERCISE_NAME = "Exercise: Simple multiple choice with automatic reset on zero score"

let context1: BrowserContext
let context2: BrowserContext
let context3: BrowserContext

test.beforeEach(async ({ browser }) => {
  context1 = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
  context2 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
  context3 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
})

test.afterEach(async () => {
  await context1.close()
  await context2.close()
  await context3.close()
})

test("Automatic reject and reset submission", async () => {
  test.slow()
  const teacherPage = await context1.newPage()
  const student1Page = await context2.newPage()
  const student2Page = await context3.newPage()

  await test.step("Students and teacher can submit answers", async () => {
    // Student1 answers the exercise
    await student1Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "3" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()

    await student1Page.getByText("Your answer was not correct").waitFor()

    // Student2 answers the exercise
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student2Page)
    await getExerciseRegion(student2Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()

    await student2Page.getByText("Good job!").waitFor()

    // Teacher answers the exercise
    await teacherPage.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(teacherPage)
    await getExerciseRegion(teacherPage, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()

    await teacherPage.getByText("Good job!").waitFor()
  })

  await test.step("Students and teacher can peer review each other", async () => {
    //Student1 gets zero points based on reviews so the submisission will be automatically reset

    // Student1 peer reviews Student2 and Teachers answers
    await student1Page.getByRole("button", { name: "Start peer review" }).click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("radio", { name: "Strongly agree" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student1Page.getByText("Operation successful!")).toBeVisible()

    await student1Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("radio", { name: "Strongly agree" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student1Page.getByText("Operation successful!")).toBeVisible()

    await expect(
      student1Page.getByRole("heading", { name: "Waiting for peer reviews" }),
    ).toBeVisible()

    // Student2 peer reviews Student1 and Teachers answers
    await student2Page.getByRole("button", { name: "Start peer review" }).click()
    await student2Page.getByRole("radio", { name: "Strongly disagree" }).click()
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student2Page.getByText("Operation successful!")).toBeVisible()

    await student2Page.getByRole("radio", { name: "Strongly disagree" }).click()
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student2Page.getByText("Operation successful!")).toBeVisible()

    await expect(student2Page.getByText("Your answer has been reviewed")).toBeVisible()

    // Teacher peer reviews Student1 and Student2 answers
    await teacherPage.getByRole("button", { name: "Start peer review" }).click()
    await teacherPage.getByRole("radio", { name: "Strongly disagree" }).click()
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(teacherPage.getByText("Operation successful!")).toBeVisible()
  })

  await test.step("Student1 can resubmit after rejection and it does not affect Student2 points or given peer reviews", async () => {
    //Student1 can redo exercise and peer review
    await student1Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "3" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(
      student1Page
        .getByLabel("Exercise:Simple multiple choice with automatic reset on zero score")
        .getByText("Start peer review"),
    ).toBeVisible()
    // Student2 still has reviews preserved
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await expect(student2Page.getByText("Your answer has been reviewed")).toBeVisible()
  })
})
