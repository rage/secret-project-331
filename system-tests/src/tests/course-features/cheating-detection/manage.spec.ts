import { BrowserContext, expect, test } from "@playwright/test"

import { answerExercise } from "@/tests/exercises/peer-reviews/peer-review-utils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})
const CHEATER_EDITOR_PAGE =
  "http://project-331.local/manage/courses/060c272f-8c68-4d90-946f-2d431114ed56/other/cheaters"
const TEST_PAGE =
  "http://project-331.local/org/uh-cs/courses/course-for-suspected-cheaters/chapter-1/page-1"

test.describe("Teacher can set threshold for course", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext
  let context4: BrowserContext

  test.beforeEach(async ({ browser }) => {
    ;[context1, context2, context3, context4] = await Promise.all([
      browser.newContext({ storageState: "src/states/student4@example.com.json" }),
      browser.newContext({ storageState: "src/states/student5@example.com.json" }),
      browser.newContext({ storageState: "src/states/teacher@example.com.json" }),
      browser.newContext({ storageState: "src/states/student3@example.com.json" }),
    ])
  })

  test.afterEach(async () => {
    await Promise.all([context1.close(), context2.close(), context3.close(), context4.close()])
  })

  test("suspected cheaters feature works", async () => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const teacherPage = await context3.newPage()
    const student3Page = await context4.newPage()

    // Teacher set thresholds
    await teacherPage.goto(CHEATER_EDITOR_PAGE)

    await teacherPage.fill('[label="Points"]', "1")
    await teacherPage.fill(`input[label="Duration (in hours)"]`, "48")

    await teacherPage.getByText("Set threshold").click()

    // Student 1 navigates to exercise and answers
    await answerExercise(student1Page, TEST_PAGE, "a")

    // Student 2 navigates to exercise and answers, and gives peer reviews to first two students
    await answerExercise(student2Page, TEST_PAGE, "b")

    // Student 3 navigates to exercise and answers
    await answerExercise(student3Page, TEST_PAGE, "b")

    // Now student 1 should see their results.
    await student1Page.reload()
    await expect(student1Page.getByTestId("exercise-points")).toContainText("0/1")
    await student1Page.getByText("Your answer was not correct").waitFor()

    // Now student 2 should see their results.
    await student2Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("1/1")
    await student2Page.getByText("Good job!").waitFor()

    // Now student 3 should see their results.
    await student3Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("1/1")
    await student2Page.getByText("Good job!").waitFor()

    // Check if the cheaters table is rightly populated
    await teacherPage.reload()
    await teacherPage.getByText("Student id").waitFor()
    await teacherPage.getByText("Duration").first().waitFor({ state: "visible" })
    await teacherPage
      .getByText("7ba4beb1-abe8-4bad-8bb2-d012c55b310c")
      .first()
      .waitFor({ state: "visible" })
    await teacherPage
      .getByText("bc403a82-1e8b-4274-acc8-d765648ef698")
      .first()
      .waitFor({ state: "hidden" })
    // Ensure Congratulation block is not shown for suspected cheaters after completion
    await student2Page.goto(
      "http://project-331.local/org/uh-cs/courses/course-for-suspected-cheaters",
    )
    await student2Page.getByText("Welcome to...").waitFor()
    await expect(student2Page.getByText("Congratulations!")).toHaveCount(0)

    // Navigate cheater's view and delete a suspected cheater
    await teacherPage.goto(CHEATER_EDITOR_PAGE)
    await teacherPage.getByText("Clear suspicion", { exact: true }).first().click()
    await teacherPage.getByText("Deleted cheaters").first().click()
    await teacherPage
      .getByText("7ba4beb1-abe8-4bad-8bb2-d012c55b310c")
      .first()
      .waitFor({ state: "visible" })

    // Teacher approve a suspected cheater
    await teacherPage.getByText("Suspected student").click()
    await teacherPage.getByText("Confirm cheating", { exact: true }).click()

    // Ensure Congratulation block is not shown for suspected cheaters after teacher approves it
    await student3Page.goto(
      "http://project-331.local/org/uh-cs/courses/course-for-suspected-cheaters",
    )
    await student3Page.getByText("Welcome to...").waitFor()
    await expect(student2Page.getByText("Congratulations!")).toHaveCount(0)
  })
})
