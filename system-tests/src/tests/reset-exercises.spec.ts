import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

let context1: BrowserContext
let context3: BrowserContext

test.beforeEach(async ({ browser }) => {
  context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })

  context3 = await browser.newContext({ storageState: "src/states/admin@example.com.json" })
})

test.afterEach(async () => {
  await context1.close()
  await context3.close()
})
test("Can manually reset exercises", async ({}) => {
  test.slow()
  const student1Page = await context1.newPage()
  const adminPage = await context3.newPage()

  // Students answers some exercises
  await student1Page.goto(
    "http://project-331.local/org/uh-cs/courses/advanced-course-instance-management",
  )

  await selectCourseInstanceIfPrompted(student1Page, "Default instance")
  await student1Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await student1Page.getByRole("link", { name: "1 Page One" }).click()
  await student1Page
    .locator('iframe[title="Exercise 1\\, task 1 content"]')
    .contentFrame()
    .getByRole("checkbox", { name: "a" })
    .click()
  await student1Page.getByRole("button", { name: "Submit" }).click()

  await student1Page.getByRole("link", { name: "Next page: Page" }).click()
  await student1Page
    .locator('iframe[title="Exercise 1\\, task 1 content"]')
    .first()
    .contentFrame()
    .getByRole("checkbox", { name: "c" })
    .click()
  await student1Page.getByRole("button", { name: "Submit" }).first().click()

  await student1Page
    .locator('iframe[title="Exercise 1\\, task 1 content"]')
    .nth(1)
    .contentFrame()
    .getByRole("checkbox", { name: "b" })
    .click()
  await student1Page.getByRole("button", { name: "Submit" }).first().click()

  await student1Page.getByRole("link", { name: "Next page: Page" }).click()

  await student1Page
    .locator('iframe[title="Exercise 2\\, task 1 content"]')
    .contentFrame()
    .getByRole("textbox", { name: "Answer" })
    .fill("a a a a a a a a a a a")
  await student1Page.getByRole("button", { name: "Submit" }).click()
  await student1Page.getByRole("button", { name: "Start peer review" }).click()

  await student1Page.goto(
    "http://project-331.local/org/uh-cs/courses/advanced-course-instance-management/chapter-1/complicated-exercise",
  )

  await student1Page
    .locator('iframe[title="Exercise 1\\, task 1 content"]')
    .contentFrame()
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await student1Page
    .locator('iframe[title="Exercise 1\\, task 2 content"]')
    .contentFrame()
    .getByRole("checkbox", { name: "Correct", exact: true })
    .click()
  await student1Page
    .locator('iframe[title="Exercise 1\\, task 3 content"]')
    .contentFrame()
    .getByRole("checkbox", { name: "Incorrect" })
    .click()
  await student1Page.getByRole("button", { name: "Submit" }).click()

  await student1Page.getByRole("link", { name: "Next page: Complicated" }).click()
  await student1Page
    .locator('iframe[title="Exercise 1\\, task 1 content"]')
    .contentFrame()
    .getByRole("button", { name: "Correct" })
    .first()
    .click()
  await student1Page
    .locator('iframe[title="Exercise 1\\, task 2 content"]')
    .contentFrame()
    .getByRole("button", { name: "Correct" })
    .first()
    .click()
  await student1Page
    .locator('iframe[title="Exercise 1\\, task 3 content"]')
    .contentFrame()
    .getByRole("button", { name: "Correct" })
    .nth(1)
    .click()
  await student1Page.getByRole("button", { name: "Submit" }).click()

  // Admin resets only exercises that have less than maximum points
  await adminPage.goto(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/other/exercise-reset-tool",
  )
  await adminPage.getByRole("button", { name: "Add students" }).click()

  await adminPage.getByTestId("add-user-button-02364d40-2aac-4763-8a06-2381fd298d79").click()

  await adminPage.getByRole("button", { name: "Close" }).click()

  await adminPage.getByText("Reset only if less than max").click()
  await adminPage.getByRole("checkbox", { name: "Best exercise" }).first().check()
  await adminPage.getByRole("checkbox", { name: "Best exercise" }).nth(1).check()
  await adminPage.getByRole("checkbox", { name: "Best exercise" }).nth(2).check()
  await adminPage.getByRole("checkbox", { name: "Best exercise" }).nth(3).check()
  await adminPage.getByRole("button", { name: "Submit and reset" }).click()
  await adminPage.getByRole("button", { name: "Yes, reset" }).click()

  await expect(adminPage.getByText("Success", { exact: true })).toBeVisible()

  // Admin checks that correct exercises are reset and found in the users reset exercises log
  await adminPage.goto("http://project-331.local/manage/users/02364d40-2aac-4763-8a06-2381fd298d79")
  await expect(adminPage.getByText("Exercise Id: ce1905e5-16a2-")).toBeVisible()

  // Admin resets only tasks that have gotten less than 2 points
  await adminPage.goto(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/other/exercise-reset-tool",
  )

  await adminPage.getByRole("button", { name: "Add students" }).click()

  await adminPage.getByTestId("add-user-button-02364d40-2aac-4763-8a06-2381fd298d79").click()

  await adminPage.getByRole("button", { name: "Close" }).click()
  await adminPage.getByRole("spinbutton", { name: "Only reset if gotten less than" }).fill("3")
  await adminPage.getByRole("checkbox", { name: "Multiple task exercise" }).check()
  await adminPage.getByRole("checkbox", { name: "Multiple task quizzes exercise" }).check()
  await adminPage.getByRole("button", { name: "Submit and reset" }).click()
  await adminPage.getByRole("button", { name: "Yes, reset" }).click()
  await expect(adminPage.getByText("Success", { exact: true })).toBeVisible()

  // Admin checks that correct exercises are reset and found in the users reset exercises log
  await adminPage.goto("http://project-331.local/manage/users/02364d40-2aac-4763-8a06-2381fd298d79")
  await expect(adminPage.getByText("Exercise Id: f22eedc4-1e66-")).toBeVisible()

  // Admin resest exercises that have a peer review
  await adminPage.goto(
    "http://project-331.local/manage/courses/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/other/exercise-reset-tool",
  )
  await adminPage.getByRole("button", { name: "Add students" }).click()

  await adminPage.getByTestId("add-user-button-02364d40-2aac-4763-8a06-2381fd298d79").click()

  await adminPage.getByRole("button", { name: "Close" }).click()
  await adminPage.getByRole("button", { name: "Exercises with Peer Review" }).click()
  await adminPage.getByRole("button", { name: "Submit and reset" }).click()
  await adminPage.getByRole("button", { name: "Yes, reset" }).click()
  await expect(adminPage.getByText("Success", { exact: true })).toBeVisible()

  // Admin checks that correct exercises are reset and found in the users reset exercises log
  await adminPage.goto("http://project-331.local/manage/users/02364d40-2aac-4763-8a06-2381fd298d79")
  await expect(adminPage.getByText("Exercise Id: 3286861b-4407-514a-8f72-")).toBeVisible()
})
