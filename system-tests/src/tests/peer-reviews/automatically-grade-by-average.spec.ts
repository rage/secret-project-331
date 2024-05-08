import { BrowserContext, expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { answerExercise, fillPeerReview, TIMEOUT } from "./peer_review_utils"

const TEST_PAGE = "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-3"

test.describe("test AutomaticallyGradeByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
    context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
    context3 = await browser.newContext({ storageState: "src/states/student3@example.com.json" })
  })

  test.afterEach(async () => {
    await context1.close()
    await context2.close()
    await context3.close()
  })

  test.only("AutomaticallyGradeByAverage", async () => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const student3Page = await context3.newPage()

    // User 1 navigates to exercise and answers
    await answerExercise(student1Page, TEST_PAGE, "a")
    await expect(student1Page.getByTestId("exercise-points")).toContainText("0/1")

    // User 2 navigates to exercise and answers
    await student2Page.goto("http://project-331.local/organizations")
    await answerExercise(student2Page, TEST_PAGE, "b")
    await expect(student2Page.getByTestId("exercise-points")).toContainText("0/1")

    // Two students review each other's answers
    await fillPeerReview(student1Page, ["Strongly disagree", "Strongly disagree"])
    await fillPeerReview(student2Page, ["Strongly agree", "Strongly agree"])
    await student1Page.getByText("No answers available to peer review yet. ").waitFor()
    await student2Page.getByText("No answers available to peer review yet. ").waitFor()

    // User 3 navigates to exercise and answers, and gives peer reviews to first two students
    await student3Page.goto("http://project-331.local/organizations")
    await answerExercise(student3Page, TEST_PAGE, "b")
    await expect(student3Page.getByTestId("exercise-points")).toContainText("0/1")
    await fillPeerReview(student3Page, ["Neither agree nor disagree", "Neither agree nor disagree"])
    await fillPeerReview(
      student3Page,
      ["Neither agree nor disagree", "Neither agree nor disagree"],
      false,
    )
    await student3Page.getByText("Waiting for other students to review your answer.").waitFor()

    // Then the first two students review the third student's answer
    await fillPeerReview(student1Page, ["Agree", "Strongly agree"], false, true)
    await fillPeerReview(student2Page, ["Strongly agree", "Agree"], false, true)

    // Now all the students should see their results.
    await student1Page.reload()
    await expect(student1Page.getByTestId("exercise-points")).toContainText("1/1")
    await student1Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()

    await student2Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("0/1")
    await student2Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()

    await student3Page.reload()
    await expect(student3Page.getByTestId("exercise-points")).toContainText("1/1")
    await student3Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()
  })
})
