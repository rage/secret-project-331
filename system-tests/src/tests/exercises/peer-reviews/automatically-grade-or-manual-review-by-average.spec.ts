import { BrowserContext, expect, test } from "@playwright/test"

import { answerExercise, fillPeerReview } from "./peer_review_utils"

import { getLocatorForNthExerciseServiceIframe } from "@/utils/iframeLocators"

const TEST_PAGE = "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-2"

test.describe("test AutomaticallyGradeOrManualReviewByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext
  let context4: BrowserContext

  test.beforeEach(async ({ browser }) => {
    ;[context1, context2, context3, context4] = await Promise.all([
      browser.newContext({ storageState: "src/states/student1@example.com.json" }),
      browser.newContext({ storageState: "src/states/student2@example.com.json" }),
      browser.newContext({ storageState: "src/states/student3@example.com.json" }),
      browser.newContext({ storageState: "src/states/teacher@example.com.json" }),
    ])
  })

  test.afterEach(async () => {
    await Promise.all([context1.close(), context2.close(), context3.close(), context4.close()])
  })
  test("AutomaticallyGradeOrManualReviewByAverage", async () => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const student3Page = await context3.newPage()
    const teacherPage = await context4.newPage()

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

    // Now student 1 and student 3 should see their results.
    await student1Page.reload()
    await expect(student1Page.getByTestId("exercise-points")).toContainText("1/1")
    await student1Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()
    await student3Page.reload()
    await expect(student3Page.getByTestId("exercise-points")).toContainText("1/1")
    await student3Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()

    // Student 2's answer was not liked by the peers so it is waiting for the teacher to review it
    await student2Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("0/1")
    await student2Page.getByText("Waiting for course staff to review your answer.").waitFor()

    // Teacher reviews answers
    await teacherPage.goto("http://project-331.local/organizations")
    await teacherPage
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await teacherPage.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await teacherPage.goto("http://project-331.local/org/uh-cs")
    await teacherPage.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await teacherPage.getByRole("tab", { name: "Exercises" }).click()
    await teacherPage
      .getByText("AutomaticallyGradeOrManualReviewByAverage 1View answers requiring attention")
      .click()

    // Make sure the iframe above is loaded so that it does not cause scrolling
    await teacherPage.getByRole("button", { name: "Custom points" }).first().waitFor()
    const frame = await getLocatorForNthExerciseServiceIframe(teacherPage, "example-exercise", 1)
    await frame.getByText("a").waitFor()

    await teacherPage.getByRole("button", { name: "Custom points" }).first().click()
    await teacherPage.getByRole("spinbutton").fill("0.75")
    await teacherPage.getByRole("button", { name: "Give custom points" }).click()
    await teacherPage.getByText("Operation successful").waitFor()

    // Now student 2 should see their results.
    await student2Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("0.75/1")

    await student2Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()
  })
})
