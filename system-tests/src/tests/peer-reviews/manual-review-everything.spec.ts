import type { BrowserContext } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

import {
  getLocatorForNthExerciseServiceIframe,
  waitForMessageChannelIframesToBeReady,
} from "../../utils/iframeLocators"
import { answerExercise, fillPeerReview } from "./peer_review_utils"

const TEST_PAGE = "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-1"

test.describe("test ManualReviewEverything behavior", () => {
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

  test("ManualReviewEverything", async () => {
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

    // Now all students should see that the teacher is reviewing their answer
    await student1Page.reload()
    await expect(student1Page.getByTestId("exercise-points")).toContainText("0/1")
    await student1Page.getByText("Waiting for course staff to review your answer.").waitFor()
    await student2Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("0/1")
    await student2Page.getByText("Waiting for course staff to review your answer.").waitFor()
    await student3Page.reload()
    await expect(student3Page.getByTestId("exercise-points")).toContainText("0/1")
    await student3Page.getByText("Waiting for course staff to review your answer.").waitFor()

    // Teacher reviews answers
    await teacherPage.goto("http://project-331.local/organizations")
    await selectOrganization(teacherPage, "University of Helsinki, Department of Computer Science")
    await teacherPage.getByRole("link", { name: "Peer review Course", exact: true }).click()
    await teacherPage.goto("http://project-331.local/org/uh-cs")
    await teacherPage.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await teacherPage.getByRole("tab", { name: "Exercises" }).click()
    await teacherPage
      .getByTestId("exercise-row")
      .filter({ hasText: "ManualReviewEverything" })
      .getByText("View answers requiring attention")
      .first()
      .click()

    await waitForMessageChannelIframesToBeReady(teacherPage)

    // Make sure the iframe above is loaded so that it does not cause scrolling
    await teacherPage.getByRole("button", { name: "Save grading decision" }).first().waitFor()
    const frame = await getLocatorForNthExerciseServiceIframe(teacherPage, "example-exercise", 1)
    await frame.getByText("a").waitFor()

    const pointsField0 = teacherPage.getByRole("textbox", { name: "Points" }).nth(0)
    await pointsField0.fill("0.25")
    await pointsField0.press("Tab")
    await waitForSuccessNotification(teacherPage, async () => {
      await teacherPage.getByRole("button", { name: "Save grading decision" }).nth(0).click()
    })
    const pointsField1 = teacherPage.getByRole("textbox", { name: "Points" }).nth(1)
    await pointsField1.fill("0.25")
    await pointsField1.press("Tab")
    await waitForSuccessNotification(teacherPage, async () => {
      await teacherPage.getByRole("button", { name: "Save grading decision" }).nth(1).click()
    })
    const pointsField2 = teacherPage.getByRole("textbox", { name: "Points" }).nth(2)
    await pointsField2.fill("0.25")
    await pointsField2.press("Tab")
    await waitForSuccessNotification(teacherPage, async () => {
      await teacherPage.getByRole("button", { name: "Save grading decision" }).nth(2).click()
    })

    // Now all students should see their results.
    await student1Page.reload()
    await expect(student1Page.getByTestId("exercise-points")).toContainText("0.25/1")
    await student1Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()
    await student2Page.reload()
    await expect(student2Page.getByTestId("exercise-points")).toContainText("0.25/1")
    await student2Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()
    await student3Page.reload()
    await expect(student3Page.getByTestId("exercise-points")).toContainText("0.25/1")
    await student3Page
      .getByText("Your answer has been reviewed and graded. New submissions are no longer allowed.")
      .waitFor()
  })
})
