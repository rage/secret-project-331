import type { BrowserContext } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { ChapterSelector } from "@/utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

const STUDENT_2_USER_ID = "d7d6246c-45a8-4ff4-bf4d-31dedfaac159"
const PLAGIARISM_FEEDBACK = "This answer is word for word another student's."
const AI_FEEDBACK = "This exercise does not allow AI."
const PARTIAL_POINTS_FEEDBACK = "Half of the answer was missing."
const PLAGIARISM_EXPLANATION = "marked it as plagiarism"
const AI_EXPLANATION = "uses AI in a way this exercise does not allow"

test.describe("flagging an answer from the submission page", () => {
  let studentContext: BrowserContext
  let teacherContext: BrowserContext

  test.beforeEach(async ({ browser }) => {
    ;[studentContext, teacherContext] = await Promise.all([
      browser.newContext({ storageState: "src/states/student2@example.com.json" }),
      browser.newContext({ storageState: "src/states/teacher@example.com.json" }),
    ])
  })

  test.afterEach(async () => {
    await Promise.all([studentContext.close(), teacherContext.close()])
  })

  test("teacher flags an answer without resetting it", async () => {
    test.slow()
    const studentPage = await studentContext.newPage()
    const teacherPage = await teacherContext.newPage()

    await test.step("student answers correctly and is awarded full points", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Custom points", exact: true }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      const chapterSelector = new ChapterSelector(studentPage)
      await chapterSelector.clickChapter(1)
      await studentPage.getByRole("link", { name: "1 Page One" }).click()
      await studentPage
        .locator('iframe[title="Exercise 1\\, task 1 content"]')
        .contentFrame()
        .getByRole("checkbox", { name: "b" })
        .click()
      await studentPage.getByRole("button", { name: "Submit" }).click()
      await studentPage.getByText("Good job!").waitFor()
      await expect(studentPage.getByTestId("exercise-points")).toContainText("1/1")
    })

    await test.step("teacher opens the answer on its own submission page", async () => {
      await teacherPage.goto("http://project-331.local/org/uh-mathstat")
      await teacherPage.getByRole("link", { name: "Manage course 'Custom points'" }).click()
      await teacherPage.getByRole("tab", { name: "Course instances" }).click()
      await teacherPage
        .getByTestId("course-instance-card")
        .filter({ has: teacherPage.getByRole("heading", { name: "Default", exact: true }) })
        .getByRole("link", { name: "View points" })
        .click()
      await teacherPage.getByRole("link", { name: STUDENT_2_USER_ID }).click()
      const exerciseDetails = teacherPage
        .getByTestId("exercise-status")
        .filter({ hasText: "Best exercise" })
        .first()
      await exerciseDetails.getByRole("button", { name: "View details" }).click()
      // The link is labelled with the submission's own id, so match it by where it leads.
      await exerciseDetails.locator('a[href^="/submissions/"]').first().click()
      await expect(teacherPage.getByRole("heading", { name: "Exercise Grading" })).toBeVisible()
    })

    await test.step("teacher marks the answer as plagiarism", async () => {
      await teacherPage.getByRole("button", { name: "Grade" }).click()
      await teacherPage.getByRole("button", { name: "Set points to 0" }).click()
      await teacherPage.getByRole("radio", { name: "Plagiarism" }).check()
      await teacherPage
        .getByRole("textbox", { name: "Feedback for student (optional)" })
        .fill(PLAGIARISM_FEEDBACK)
      await waitForSuccessNotification(teacherPage, async () => {
        await teacherPage.getByRole("button", { name: "Save grading decision" }).click()
      })
    })

    await test.step("student loses the points and reads the feedback", async () => {
      await studentPage.reload()
      await expect(studentPage.getByTestId("exercise-points")).toContainText("0/1")
      // The reason for the decision is explained first, the teacher's own words after it.
      await expect(studentPage.getByText(PLAGIARISM_EXPLANATION)).toBeVisible()
      await expect(studentPage.getByText(PLAGIARISM_FEEDBACK)).toBeVisible()
      // Flagging alone must not reopen the exercise; that takes the reset checkbox.
      await expect(studentPage.getByText("The course staff has reviewed")).toBeHidden()
    })

    await test.step("teacher changes the flag to unauthorized AI use", async () => {
      await teacherPage.getByRole("button", { name: "Grade" }).click()
      await teacherPage.getByRole("button", { name: "Set points to 0" }).click()
      await teacherPage.getByRole("radio", { name: "Unauthorized AI use" }).check()
      await teacherPage
        .getByRole("textbox", { name: "Feedback for student (optional)" })
        .fill(AI_FEEDBACK)
      await waitForSuccessNotification(teacherPage, async () => {
        await teacherPage.getByRole("button", { name: "Save grading decision" }).click()
      })
    })

    await test.step("student reads the newer feedback instead", async () => {
      await studentPage.reload()
      await expect(studentPage.getByText(AI_EXPLANATION)).toBeVisible()
      await expect(studentPage.getByText(AI_FEEDBACK)).toBeVisible()
      await expect(studentPage.getByText(PLAGIARISM_EXPLANATION)).toBeHidden()
      await expect(studentPage.getByText(PLAGIARISM_FEEDBACK)).toBeHidden()
    })

    await test.step("teacher awards partial points with feedback instead", async () => {
      await teacherPage.getByRole("button", { name: "Grade" }).click()
      await teacherPage.getByRole("textbox", { name: "Points", exact: true }).fill("0.5")
      await teacherPage
        .getByRole("textbox", { name: "Feedback for student (optional)" })
        .fill(PARTIAL_POINTS_FEEDBACK)
      await waitForSuccessNotification(teacherPage, async () => {
        await teacherPage.getByRole("button", { name: "Save grading decision" }).click()
      })
    })

    await test.step("student sees the feedback without a flag explanation", async () => {
      await studentPage.reload()
      await expect(studentPage.getByTestId("exercise-points")).toContainText("0.5/1")
      await expect(studentPage.getByText(PARTIAL_POINTS_FEEDBACK)).toBeVisible()
      await expect(studentPage.getByText(AI_EXPLANATION)).toBeHidden()
    })
  })
})
