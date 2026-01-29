import { BrowserContext, expect, test } from "@playwright/test"

import { getExerciseRegion, selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { fillPromptDialog } from "@/utils/dialogs"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const COURSE_URL =
  "http://project-331.local/org/uh-mathstat/courses/spam-answers-skip-teacher-review-course/chapter-1/page-1"
const EXERCISE_NAME = "Exercise: Simple multiple choice with peer review"

let student1Context: BrowserContext
let student2Context: BrowserContext

test.beforeEach(async ({ browser }) => {
  student1Context = await browser.newContext({
    storageState: "src/states/student1@example.com.json",
  })
  student2Context = await browser.newContext({
    storageState: "src/states/student2@example.com.json",
  })
})

test.afterEach(async () => {
  await student1Context.close()
  await student2Context.close()
})

test("Reset flagged answers without manual review", async () => {
  test.slow()
  const student1Page = await student1Context.newPage()
  const student2Page = await student2Context.newPage()

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
    await fillPromptDialog(student2Page, "Spam report for reset", true)

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
