import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.describe("test teacher changing grade behavior", () => {
  let studentContext: BrowserContext
  let teacherContext: BrowserContext

  test.beforeEach(async ({ browser }) => {
    ;[studentContext, teacherContext] = await Promise.all([
      browser.newContext({ storageState: "src/states/student1@example.com.json" }),
      browser.newContext({ storageState: "src/states/teacher@example.com.json" }),
    ])
  })

  test.afterEach(async () => {
    await Promise.all([studentContext.close(), teacherContext.close()])
  })

  test("teacher changing grade", async () => {
    const studentPage = await studentContext.newPage()
    const teacherPage = await teacherContext.newPage()

    await test.step("student submits exercise", async () => {
      await studentPage.goto("http://project-331.local/")
      await studentPage.getByRole("link", { name: "All organizations" }).click()
      await studentPage
        .getByRole("link", {
          name: "University of Helsinki, Department of Mathematics and Statistics",
        })
        .click()

      await studentPage.getByRole("link", { name: "Navigate to course 'Custom" }).click()
      await selectCourseInstanceIfPrompted(studentPage)
      await studentPage.getByRole("link", { name: "Chapter 1 The Basics" }).click()
      await studentPage.getByRole("link", { name: "1 Page One" }).click()
      await studentPage
        .locator('iframe[title="Exercise 1\\, task 1 content"]')
        .contentFrame()
        .getByRole("checkbox", { name: "a" })
        .click()
      await studentPage.getByRole("button", { name: "Submit" }).click()
      await studentPage.getByText("Your answer was not correct").waitFor()
    })

    await test.step("teacher changes grade", async () => {
      await teacherPage.goto("http://project-331.local/org/uh-mathstat")
      await teacherPage.getByRole("link", { name: "Manage course 'Custom points'" }).click()
      await teacherPage.getByRole("tab", { name: "Course instances" }).click()
      await teacherPage
        .getByTestId("course-instance-card")
        .filter({ has: teacherPage.getByRole("heading", { name: "Default", exact: true }) })
        .getByRole("link", { name: "View points" })
        .click()
      await teacherPage.getByRole("link", { name: "02364d40-2aac-4763-8a06-2381fd298d79	" }).click()

      const exerciseDetailsComponent = teacherPage
        .getByTestId("exercise-status")
        .filter({ hasText: "Best exercise" })
        .first()

      await exerciseDetailsComponent.getByText("1 submissions").waitFor()

      await exerciseDetailsComponent.getByRole("button", { name: "View details" }).click()

      await exerciseDetailsComponent.getByRole("button", { name: "Give custom points" }).click()
      await teacherPage.getByRole("slider").fill("0.5")
      await teacherPage
        .locator("#custom-point-popup")
        .getByRole("button", { name: "Give custom points" })
        .click()
      await teacherPage.getByText("Operation successful").first().waitFor()
    })

    await test.step("verify student sees updated grade", async () => {
      await studentPage.reload()
      await expect(studentPage.getByTestId("exercise-points")).toContainText("0.5/1")
    })
  })
})
