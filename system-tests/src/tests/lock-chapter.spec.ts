import { BrowserContext, expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { clickPageInChapterByTitle } from "@/utils/flows/pagesInChapter.flow"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

test.describe.only("Chapter locking feature", () => {
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
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
    })

    await test.step("Verify lock block is visible and unlockable", async () => {
      await studentPage.getByText("Mark Chapter as Complete").waitFor()
      await expect(studentPage.getByRole("button", { name: "Lock Chapter" })).toBeVisible()
    })

    await test.step("Lock Chapter 1", async () => {
      await studentPage.getByRole("button", { name: "Lock Chapter" }).click()
      await expect(
        studentPage.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Confirm" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
      await expect(
        studentPage.getByText(
          "The current chapter is locked, and you can no longer submit exercises.",
        ),
      ).toBeVisible()
    })

    await test.step("Verify model solution content is visible after locking", async () => {
      await expect(studentPage.getByRole("heading", { name: "Model Solution" })).toBeVisible()
      await expect(
        studentPage.getByText(
          "Congratulations on completing Chapter 1! Here's a model solution for the Customer Behavior Analysis Project.",
        ),
      ).toBeVisible()
      await expect(
        studentPage.getByText(
          "Strong positive correlation (r=0.72) between income and purchase amount",
        ),
      ).toBeVisible()
      await expect(
        studentPage.getByText(
          "The key insight from this analysis is that customer segmentation reveals distinct purchasing behaviors that can inform targeted marketing strategies.",
        ),
      ).toBeVisible()
    })

    await test.step("Run accessibility check on locked chapter with model solution", async () => {
      await accessibilityCheck(studentPage, "Locked chapter with model solution", [])
    })

    await test.step("Navigate to exercise in locked Chapter 1", async () => {
      await studentPage.getByText("Exercise in Chapter 1").click()
      await expect(studentPage.getByText("No submission received for this exercise.")).toBeVisible()
    })

    await test.step("Verify exercise shows locked warning", async () => {
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
    })

    await test.step("Verify submit button is not visible when chapter is locked", async () => {
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
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
      await expect(
        studentPage.getByText("Are you sure you want to lock this chapter?"),
      ).toBeVisible()
      await studentPage.getByRole("button", { name: "Confirm" }).click()
      await studentPage.getByText("Chapter locked").waitFor()
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
    })

    await test.step("Verify persistence - reload and check locked state", async () => {
      await studentPage.reload()
      await selectCourseInstanceIfPrompted(studentPage)
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()
    })

    await test.step("Verify Chapter 1 still locked after reload", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 1 - Lockable").click()
      await clickPageInChapterByTitle(studentPage, "Lock Chapter Page")
      await expect(studentPage.getByText("Chapter locked")).toBeVisible()
    })

    await test.step("Verify exercise in Chapter 2 cannot be submitted", async () => {
      await studentPage.getByRole("link", { name: "Lock Chapter Test Course" }).click()
      await studentPage.getByText("Chapter 2 - Add Lock Later").click()
      await clickPageInChapterByTitle(studentPage, "Exercise in Chapter 2")
      await expect(studentPage.getByText("No submission received for this exercise.")).toBeVisible()
      await expect(
        studentPage
          .getByText("The current chapter is locked, and you can no longer submit exercises.")
          .first(),
      ).toBeVisible()
      await expect(studentPage.getByRole("button", { name: "Submit" })).toBeHidden()
    })
  })
})
