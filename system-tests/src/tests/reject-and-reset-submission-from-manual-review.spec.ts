import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { hideToasts, showNextToastsInfinitely } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

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

test("Reject and reset submission", async () => {
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
    await student1Page
      .getByRole("region", { name: "Exercise: Simple multiple choice with peer review" })
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "3" })
      .click()

    await student1Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()

    await student1Page.getByText("Your answer was not correct").waitFor()

    await expect(
      student1Page
        .getByLabel("Exercise:Simple multiple choice with peer review")
        .getByRole("button", { name: "Start peer review" }),
    ).toBeVisible()
    // Student2 answers the exercise
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student2Page)
    await student2Page
      .getByRole("region", { name: "Exercise: Simple multiple choice with peer review" })
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()

    await student2Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await student2Page.getByText("Good job!").waitFor()

    await expect(
      student2Page
        .getByLabel("Exercise:Simple multiple choice with peer review")
        .getByRole("button", { name: "Start peer review" }),
    ).toBeVisible()
    // Teacher answers the exercise
    await teacherPage.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(teacherPage)
    await teacherPage
      .getByRole("region", { name: "Exercise: Simple multiple choice with peer review" })
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await teacherPage.getByText("Good job!").waitFor()

    await expect(
      teacherPage
        .getByLabel("Exercise:Simple multiple choice with peer review")
        .getByRole("button", { name: "Start peer review" }),
    ).toBeVisible()
  })

  await test.step("Students and teacher can peer review each other", async () => {
    //Student1 gets a bad review from both so the submission will be moved to manual review

    // Student1 peer reviews Student2 and Teachers answers
    await showNextToastsInfinitely(student1Page)
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Start peer review" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("radio", { name: "Strongly agree" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student1Page.getByText("Operation successful!")).toBeVisible()
    await hideToasts(student1Page)

    await showNextToastsInfinitely(student1Page)
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("radio", { name: "Strongly agree" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student1Page.getByText("Operation successful!")).toBeVisible()
    await hideToasts(student1Page)

    await expect(
      student1Page.getByRole("heading", { name: "Waiting for peer reviews" }),
    ).toBeVisible()

    // Student2 peer reviews Student1 and Teachers answers
    await showNextToastsInfinitely(student2Page)
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Start peer review" })
      .click()
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("radio", { name: "Strongly disagree" })
      .click()
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student2Page.getByText("Operation successful!")).toBeVisible()
    await hideToasts(student2Page)

    await showNextToastsInfinitely(student2Page)
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("radio", { name: "Strongly disagree" })
      .click()
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("radio", { name: "Strongly disagree" })
      .click()
    await student2Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student2Page.getByText("Operation successful!")).toBeVisible()
    await hideToasts(student2Page)

    await expect(
      student2Page
        .getByLabel("Exercise:Simple multiple choice with peer review")
        .getByText("Your answer has been reviewed"),
    ).toBeVisible()

    // Teacher peer reviews Student1 and Student2 answers
    await showNextToastsInfinitely(teacherPage)
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Start peer review" })
      .click()
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("radio", { name: "Strongly disagree" })
      .click()
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(teacherPage.getByText("Operation successful!")).toBeVisible()
    await hideToasts(teacherPage)

    await showNextToastsInfinitely(teacherPage)
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("radio", { name: "Strongly disagree" })
      .click()
    await teacherPage
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(teacherPage.getByText("Operation successful!")).toBeVisible()
    await hideToasts(teacherPage)

    await expect(
      teacherPage
        .getByLabel("Exercise:Simple multiple choice with peer review")
        .getByText("Your answer has been reviewed"),
    ).toBeVisible()
  })

  await test.step("Teacher can reject and reset Student1 submission", async () => {
    await teacherPage.goto(
      "http://project-331.local/manage/courses/5158f2c6-98d9-4be9-b372-528f2c736dd7/exercises",
    )
    await teacherPage.getByRole("link", { name: "View answers requiring" }).click()
    await teacherPage.getByRole("button", { name: "Reject and reset" }).first().click()
    await expect(teacherPage.getByText("Operation successful!")).toBeVisible()
  })

  await test.step("Student1 can resubmit after rejection and it does not affect Student2 points or given peer reviews", async () => {
    //Student1 can redo the exercise and peer review
    await student1Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await expect(
      student1Page
        .getByLabel("Exercise:Simple multiple choice with peer review")
        .getByText("The course staff has reviewed"),
    ).toBeVisible()
    await student1Page
      .getByRole("region", { name: "Exercise: Simple multiple choice with peer review" })
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()
    await student1Page
      .getByLabel("Exercise:Simple multiple choice with peer review")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student1Page.getByText("Good job!")).toBeVisible()

    // Student2 still has reviews preserved
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await expect(
      student2Page
        .getByLabel("Exercise:Simple multiple choice with peer review")
        .getByText("Your answer has been reviewed"),
    ).toBeVisible()
  })
})
