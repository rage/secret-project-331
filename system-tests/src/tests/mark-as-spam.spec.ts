import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

let context1: BrowserContext
let context2: BrowserContext
let context3: BrowserContext

test.beforeEach(async ({ browser }) => {
  context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
  context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
  context3 = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
})

test.afterEach(async () => {
  await context1.close()
  await context2.close()
  await context3.close()
})

test("Mark answer as spam in peer review", async () => {
  test.slow()
  const student1Page = await context1.newPage()
  const student2Page = await context2.newPage()
  const teacherPage = await context3.newPage()

  await test.step("Teacher configures flag threshold", async () => {
    await teacherPage.goto(
      "http://project-331.local/manage/courses/c47e1cfd-a2da-4fd1-aca8-f2b2d906c4c0",
    )
    await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()

    await teacherPage
      .getByLabel("Threshold to move flagged answer to manual review", { exact: true })
      .fill("1")
    await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
    await expect(teacherPage.getByText("Success", { exact: true })).toBeVisible()
  })

  await test.step("Student1 submits answer", async () => {
    await student1Page.goto(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-4",
    )
    await selectCourseInstanceIfPrompted(student1Page, "Default instance")

    await student1Page
      .locator('iframe[title="Exercise 1\\, task 1 content"]')
      .contentFrame()
      .getByRole("checkbox", { name: "b" })
      .click()
    await student1Page.getByRole("button", { name: "Submit" }).click()
  })
  await test.step("Student2 submits answer and reports Student1's answer in peer review", async () => {
    await student2Page.goto(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-4",
    )
    await selectCourseInstanceIfPrompted(student2Page, "Default instance")

    await student2Page
      .locator('iframe[title="Exercise 1\\, task 1 content"]')
      .contentFrame()
      .getByRole("checkbox", { name: "b" })
      .click()
    await student2Page.getByRole("button", { name: "Submit" }).click()

    await student2Page.getByRole("button", { name: "Start peer review" }).click()
    await student2Page.getByRole("button", { name: "Report" }).click()
    await student2Page.getByText("Spam", { exact: true }).click()

    await student2Page.getByPlaceholder("Optional description...").fill("I think this is spam")
    await student2Page.getByLabel("Submit").click()
    await expect(student2Page.getByText("Success", { exact: true })).toBeVisible()
  })

  await test.step("Teacher can see the reported answer that has exceeded the reporting threshold", async () => {
    await teacherPage.goto(
      "http://project-331.local/manage/courses/c47e1cfd-a2da-4fd1-aca8-f2b2d906c4c0",
    )
    await teacherPage.getByRole("tab", { name: "Exercises" }).click()
    await teacherPage.getByRole("link", { name: "View answers requiring" }).click()
    await teacherPage.getByRole("heading", { name: "Answers requiring attention" }).click()
    await teacherPage.getByText("Received reports1").click()
    await expect(
      teacherPage.getByText("Description: I think this is spam", { exact: true }),
    ).toBeVisible()
  })
})
