import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "@/utils/iframeLocators"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

test.describe("Chapter locking feature", () => {
  let studentContext: BrowserContext
  let teacherContext: BrowserContext

  test.beforeEach(async ({ browser }) => {
    studentContext = await browser.newContext({
      storageState: "src/states/student1@example.com.json",
    })
    teacherContext = await browser.newContext({
      storageState: "src/states/teacher@example.com.json",
    })
  })

  test.afterEach(async () => {
    await Promise.all([studentContext.close(), teacherContext.close()])
  })

  test("Chapter locking works correctly", async () => {
    const studentPage = await studentContext.newPage()
    const teacherPage = await teacherContext.newPage()

    await test.step("Navigate to Chapter 1 as student", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        studentPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await studentPage.getByText("Lock Chapter Page").click()
    })

    await test.step("Verify lock block is visible and unlockable", async () => {
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
    })

    await test.step("Lock Chapter 1", async () => {
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })

    await test.step("Navigate to exercise in locked Chapter 1", async () => {
      await studentPage.getByText("Exercise in Chapter 1").click()
      const frame = await getLocatorForNthExerciseServiceIframe(studentPage, "quizzes", 1)
      await frame.getByLabel("Correct answer").waitFor()
    })

    await test.step("Verify exercise shows locked warning", async () => {
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })

    await test.step("Attempt to submit exercise in locked chapter", async () => {
      const frame = await getLocatorForNthExerciseServiceIframe(studentPage, "quizzes", 1)
      await frame.getByLabel("Correct answer").click()
      await studentPage.getByRole("button", { name: "Submit" }).click()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })

    await test.step("Add lock block to Chapter 2 as teacher", async () => {
      await teacherPage.goto("http://project-331.local/")
      await teacherPage.getByRole("link", { name: "All organizations" }).click()
      await selectOrganization(
        teacherPage,
        "University of Helsinki, Department of Mathematics and Statistics",
      )
      await teacherPage.getByLabel("Manage course 'Lock Chapter Test Course'").click()
      await teacherPage.getByRole("tab", { name: "Pages" }).click()
      await teacherPage
        .getByRole("row", { name: /Exercise in Chapter 2/ })
        .getByRole("button", { name: "Edit page" })
        .click()
      await teacherPage.getByRole("button", { name: "Add block" }).click()
      await teacherPage.getByPlaceholder("Search").fill("lock")
      await teacherPage.getByRole("option", { name: "Lock Chapter" }).click()
      await teacherPage.getByRole("button", { name: "Save", exact: true }).click()
      await waitForSuccessNotification(teacherPage)
    })

    await test.step("Navigate to Chapter 2 as student", async () => {
      await studentPage.goto(
        "http://project-331.local/org/uh-mathstat/courses/lock-chapter-test-course/chapter-2/exercise-page",
      )
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
    })

    await test.step("Verify lock block is now visible in Chapter 2", async () => {
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
    })

    await test.step("Lock Chapter 2", async () => {
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })

    await test.step("Verify persistence - reload and check locked state", async () => {
      await studentPage.reload()
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()
    })

    await test.step("Verify Chapter 1 still locked after reload", async () => {
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await studentPage.getByText("Lock Chapter Page").click()
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()
    })

    await test.step("Verify exercise in Chapter 2 cannot be submitted", async () => {
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await studentPage.getByText("Exercise in Chapter 2").click()
      const frame = await getLocatorForNthExerciseServiceIframe(studentPage, "quizzes", 1)
      await frame.getByLabel("Correct answer").waitFor()
      await frame.getByLabel("Correct answer").click()
      await studentPage.getByRole("button", { name: "Submit" }).click()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })
  })
})
