import { BrowserContext, expect, test } from "@playwright/test"

import { answerExercise } from "./peer-reviews/peer_review_utils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})
const CHEATER_EDITOR_PAGE =
  "http://project-331.local/manage/courses/060c272f-8c68-4d90-946f-2d431114ed56/cheaters"
const TEST_PAGE =
  "http://project-331.local/org/uh-cs/courses/course-for-suspected-cheaters/chapter-1/page-1"

test.describe("Teacher can set threshold for course", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext

  test.beforeEach(async ({ browser }) => {
    ;[context1, context2, context3] = await Promise.all([
      browser.newContext({ storageState: "src/states/student4@example.com.json" }),
      browser.newContext({ storageState: "src/states/student5@example.com.json" }),
      browser.newContext({ storageState: "src/states/teacher@example.com.json" }),
    ])
  })

  test.afterEach(async () => {
    await Promise.all([context1.close(), context2.close(), context3.close()])
  })

  test.only("suspected cheaters feature works", async ({ page }) => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const teacherPage = await context3.newPage()

    // Teacher set thresholds
    await teacherPage.goto("http://project-331.local/organizations")
    await page.goto(CHEATER_EDITOR_PAGE)

    await page.fill('[label="Points"]', "1")
    await page.fill(`input[label="Duration (in hours)"]`, "259200")

    await page.getByText("Set threshold").click()

    // Student 1 navigates to exercise and answers
    await answerExercise(student1Page, TEST_PAGE, "a")
    await expect(student1Page.getByTestId("exercise-points")).toContainText("0/1")

    // Student 2 navigates to exercise and answers, and gives peer reviews to first two students
    await student2Page.goto("http://project-331.local/organizations")
    await answerExercise(student2Page, TEST_PAGE, "b")
    // await expect(student2Page.getByTestId("exercise-points")).toContainText("0/1")

    // Now all the student 1 should see their results.
    await student1Page.reload()
    await expect(student1Page.getByTestId("exercise-points")).toContainText("0/1")
    await student1Page.getByText("Your answer was not correct").waitFor()

    // Now all the student 2 should see their results.
    await student2Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("1/1")
    await student2Page.getByText("Good job!").waitFor()

    // Teacher reviews suspected cheaters
    // await teacherPage.goto("http://project-331.local/organizations")
    // await page
    //   .getByLabel("University of Helsinki, Department of Mathematics and Statistics")
    //   .click()
    // await page.getByLabel("Manage course 'Audio course'").click()
    // await page.getByRole("tab", { name: "Cheaters" }).click()
    await page.goto(CHEATER_EDITOR_PAGE)
    const table = expect(teacherPage.getByTestId("cheaters-table"))

    expect(table).not.toBeNull()

    // // Count the number of rows in the table body
    // const rows = page.locator('table[data-testid="cheaters-table"] tbody tr')

    // // Assert that the number of rows is greater than one
    // expect(rows.count()).toBeGreaterThan(1)
  })
})
