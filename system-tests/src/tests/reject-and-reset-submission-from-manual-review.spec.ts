import type { BrowserContext, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { getExerciseRegion, selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { waitForExerciseServiceIframeToBeStable } from "@/utils/iframeLocators"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const EXERCISE_NAME = "Exercise: Simple multiple choice with peer review"

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

/**
 * Picks one peer review answer and makes sure it stuck.
 *
 * The form remounts while the reviewed answer's iframe settles, which silently drops a selection
 * made a moment too early -- the radio keeps focus but loses its checked state, leaving Submit
 * disabled.
 */
async function selectPeerReviewAnswer(page: Page, name: string) {
  const radio = getExerciseRegion(page, EXERCISE_NAME).getByRole("radio", { name })
  await expect(async () => {
    await radio.click()
    await expect(radio).toBeChecked()
  }).toPass({ timeout: 15_000 })
}

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

    await expect(
      getExerciseRegion(student1Page, EXERCISE_NAME).getByRole("button", {
        name: "Start peer review",
      }),
    ).toBeVisible()
    // Student2 answers the exercise
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student2Page)
    await getExerciseRegion(student2Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()

    await getExerciseRegion(student2Page, EXERCISE_NAME)
      .getByRole("button", { name: "Submit" })
      .click()
    await getExerciseRegion(student2Page, EXERCISE_NAME).getByText("Good job!").waitFor()

    await expect(
      getExerciseRegion(student2Page, EXERCISE_NAME).getByRole("button", {
        name: "Start peer review",
      }),
    ).toBeVisible()
    // Teacher answers the exercise
    await teacherPage.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(teacherPage)
    await getExerciseRegion(teacherPage, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()
    await getExerciseRegion(teacherPage, EXERCISE_NAME)
      .getByRole("button", { name: "Submit" })
      .click()
    await getExerciseRegion(teacherPage, EXERCISE_NAME).getByText("Good job!").waitFor()

    await expect(
      getExerciseRegion(teacherPage, EXERCISE_NAME).getByRole("button", {
        name: "Start peer review",
      }),
    ).toBeVisible()
  })

  await test.step("Students and teacher can peer review each other", async () => {
    //Student1 gets a bad review from both so the submission will be moved to manual review

    // Student1 peer reviews Student2 and Teachers answers
    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .getByRole("button", { name: "Start peer review" })
      .click()
    await selectPeerReviewAnswer(student1Page, "Strongly agree")
    await waitForSuccessNotification(student1Page, async () => {
      await getExerciseRegion(student1Page, EXERCISE_NAME)
        .getByRole("button", { name: "Submit" })
        .click()
    })

    await selectPeerReviewAnswer(student1Page, "Strongly agree")
    await waitForSuccessNotification(student1Page, async () => {
      await getExerciseRegion(student1Page, EXERCISE_NAME)
        .getByRole("button", { name: "Submit" })
        .click()
    })

    await expect(
      student1Page.getByRole("heading", { name: "Waiting for peer reviews" }),
    ).toBeVisible()

    // Student2 peer reviews Student1 and Teachers answers
    await getExerciseRegion(student2Page, EXERCISE_NAME)
      .getByRole("button", { name: "Start peer review" })
      .click()
    await selectPeerReviewAnswer(student2Page, "Strongly disagree")
    await waitForSuccessNotification(student2Page, async () => {
      await getExerciseRegion(student2Page, EXERCISE_NAME)
        .getByRole("button", { name: "Submit" })
        .click()
    })

    await selectPeerReviewAnswer(student2Page, "Strongly disagree")
    await waitForSuccessNotification(student2Page, async () => {
      await getExerciseRegion(student2Page, EXERCISE_NAME)
        .getByRole("button", { name: "Submit" })
        .click()
    })

    await expect(
      getExerciseRegion(student2Page, EXERCISE_NAME).getByText("Your answer has been reviewed"),
    ).toBeVisible()

    // Teacher peer reviews Student1 and Student2 answers
    await getExerciseRegion(teacherPage, EXERCISE_NAME)
      .getByRole("button", { name: "Start peer review" })
      .click()
    await selectPeerReviewAnswer(teacherPage, "Strongly disagree")
    await waitForSuccessNotification(teacherPage, async () => {
      await getExerciseRegion(teacherPage, EXERCISE_NAME)
        .getByRole("button", { name: "Submit" })
        .click()
    })

    await selectPeerReviewAnswer(teacherPage, "Strongly disagree")
    await waitForSuccessNotification(teacherPage, async () => {
      await getExerciseRegion(teacherPage, EXERCISE_NAME)
        .getByRole("button", { name: "Submit" })
        .click()
    })

    await expect(
      getExerciseRegion(teacherPage, EXERCISE_NAME).getByText("Your answer has been reviewed"),
    ).toBeVisible()
  })

  const teacherFeedbackText = "Please recheck your answer and try again."

  await test.step("Teacher can reject and reset Student1 submission", async () => {
    await teacherPage.goto(
      "http://project-331.local/manage/courses/5158f2c6-98d9-4be9-b372-528f2c736dd7/exercises",
    )
    await teacherPage.getByRole("link", { name: "View answers requiring" }).click()
    // The grading form sits under the answer's iframe, which reports its height in a burst after
    // the page renders. A press landing mid-reflow is lost: react-aria cancels a press whose
    // pointerup happens over a different element, while Playwright still reports the click as done.
    // Waiting for the frame removes the known reflow; re-pressing covers the ones it cannot.
    await waitForExerciseServiceIframeToBeStable(teacherPage, "example-exercise", 1)
    const resetAnswer = teacherPage.getByRole("checkbox", { name: "Reset answer" })
    await expect(async () => {
      await teacherPage.getByRole("button", { name: "Set points to 0" }).click()
      await expect(resetAnswer).toBeVisible()
    }).toPass({ timeout: 15_000 })
    await resetAnswer.check()
    await teacherPage
      .getByRole("textbox", { name: "Feedback for student (optional)" })
      .fill(teacherFeedbackText)
    await waitForSuccessNotification(teacherPage, async () => {
      await teacherPage.getByRole("button", { name: "Save grading decision" }).click()
    })
  })

  await test.step("Student1 can resubmit after rejection and it does not affect Student2 points or given peer reviews", async () => {
    //Student1 can redo the exercise and peer review
    await student1Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    // The redo instruction is what tells the student the exercise reopened, so the teacher's own
    // feedback is shown alongside it rather than instead of it.
    await expect(
      getExerciseRegion(student1Page, EXERCISE_NAME).getByText("The course staff has reviewed"),
    ).toBeVisible()
    await expect(
      getExerciseRegion(student1Page, EXERCISE_NAME).getByText(teacherFeedbackText),
    ).toBeVisible()
    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .frameLocator('iframe[title="Exercise 1, task 1 content"]')
      .getByRole("checkbox", { name: "4" })
      .click()
    await getExerciseRegion(student1Page, EXERCISE_NAME)
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(
      getExerciseRegion(student1Page, EXERCISE_NAME).getByText("Good job!"),
    ).toBeVisible()

    // Student2 still has reviews preserved
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/reject-and-reset-submission-with-peer-reviews-course/chapter-1/page-1",
    )
    await expect(
      getExerciseRegion(student2Page, EXERCISE_NAME).getByText("Your answer has been reviewed"),
    ).toBeVisible()
  })
})
