import { BrowserContext, expect, test } from "@playwright/test"

import { getExerciseRegion, selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const COURSE_URL =
  "http://project-331.local/org/uh-mathstat/courses/spam-answers-skip-teacher-review-course/chapter-1/page-1"
const MANAGE_COURSE_URL =
  "http://project-331.local/manage/courses/e91eb0d0-1737-44e8-9554-a9492e69ddc7"
const EXERCISE_NAME = "Exercise: Simple multiple choice with peer review"

let teacherContext: BrowserContext
let student1Context: BrowserContext
let student2Context: BrowserContext

test.beforeEach(async ({ browser }) => {
  teacherContext = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
  student1Context = await browser.newContext({
    storageState: "src/states/student1@example.com.json",
  })
  student2Context = await browser.newContext({
    storageState: "src/states/student2@example.com.json",
  })
})

test.afterEach(async () => {
  await teacherContext.close()
  await student1Context.close()
  await student2Context.close()
})

test("Reset flagged answers without manual review", async () => {
  test.slow()
  const teacherPage = await teacherContext.newPage()
  const student1Page = await student1Context.newPage()
  const student2Page = await student2Context.newPage()

  await test.step("Teacher enables automatic reset for flagged answers", async () => {
    await teacherPage.goto(MANAGE_COURSE_URL)
    await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()

    await teacherPage
      .getByLabel("Threshold to move flagged answer to manual review", { exact: true })
      .fill("1")
    await teacherPage
      .getByLabel("Reset answers automatically when flagged too many times", { exact: true })
      .check()
    await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
    await waitForSuccessNotification(teacherPage)
  })

  await test.step("Student1 submits an answer", async () => {
    await student1Page.goto(COURSE_URL)
    await selectCourseInstanceIfPrompted(student1Page)

    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "3" })
      .click()

    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .getByRole("button", { name: "Submit" })
      .click()

    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .getByText("Your answer was not correct")
      .waitFor()
  })

  await test.step("Student2 reports Student1 as spam in peer review", async () => {
    await student2Page.goto(COURSE_URL)
    await selectCourseInstanceIfPrompted(student2Page)

    await getExerciseRegion(student2Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()

    await getExerciseRegion(student2Page, EXERCISE_NAME)
      .getByRole("button", { name: "Submit" })
      .click()

    await student2Page.getByRole("button", { name: "Start peer review" }).click()
    await student2Page.getByRole("button", { name: "Report" }).click()
    await student2Page.getByText("Spam", { exact: true }).click()
    await student2Page.getByPlaceholder("Optional description...").fill("Spam report for reset")
    await student2Page.getByLabel("Report Answer").getByRole("button", { name: "Submit" }).click()

    await waitForSuccessNotification(student2Page)
  })

  await test.step("Student1 can retry after being flagged", async () => {
    await student1Page.goto(COURSE_URL)
    await selectCourseInstanceIfPrompted(student1Page)

    await expect(
      getExerciseRegion(student1Page, EXERCISE_NAME).getByText(
        "Your answer was flagged too many times and needs to be redone. Please try again.",
      ),
    ).toBeVisible()

    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()

    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .getByRole("button", { name: "Submit" })
      .click()

    await expect(
      getExerciseRegion(student1Page, EXERCISE_NAME).getByRole("button", {
        name: "Start peer review",
      }),
    ).toBeVisible()
  })
})
