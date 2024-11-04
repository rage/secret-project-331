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

test("Join course by code only", async ({}) => {
  test.slow()
  const student1Page = await context1.newPage()
  const student2Page = await context2.newPage()
  const teacherPage = await context3.newPage()

  // Check that student can't see to the course
  await student1Page.goto("http://project-331.local/org/uh-mathstat/courses/joinable-by-code-only")
  await student1Page.getByText("Unauthorized", { exact: true }).waitFor()

  // Go to join page and add student to the course
  await student1Page.goto(
    "http://project-331.local/join?code=zARvZARjYhESMPVceEgZyJGQZZuUHVVgcUepyzEqzSqCMdbSCDrTaFhkJTxBshWU",
  )
  await student1Page.getByRole("heading", { name: "Joinable by code only" }).click()
  await student1Page.getByRole("button", { name: "Yes" }).click()

  // Check that student can see the course
  await selectCourseInstanceIfPrompted(student1Page)
  await student1Page.getByRole("heading", { name: "Welcome to..." }).click()

  // Check that student can't see to the course
  await student2Page.goto("http://project-331.local/org/uh-mathstat/courses/joinable-by-code-only")
  await student2Page.getByText("Unauthorized", { exact: true }).waitFor()

  // Go to join page and add student to the course
  await student2Page.goto(
    "http://project-331.local/join?code=zARvZARjYhESMPVceEgZyJGQZZuUHVVgcUepyzEqzSqCMdbSCDrTaFhkJTxBshWU",
  )
  await student2Page.getByRole("heading", { name: "Joinable by code only" }).click()
  await student2Page.getByRole("button", { name: "Yes" }).click()

  // Check that student can see the course
  await selectCourseInstanceIfPrompted(student2Page)
  await student2Page.getByRole("heading", { name: "Welcome to..." }).click()

  // Check that teacher can change the course to join by code only
  await teacherPage.goto(
    "http://project-331.local/manage/courses/049061ba-ac30-49f1-aa9d-b7566dc22b78",
  )

  // Check that generate join code button is not visible if the feature is not enabled
  await expect(teacherPage.getByText("Generate join course link", { exact: true })).toBeHidden()

  // Change course to be joinable by code only
  await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()
  await teacherPage.getByText("Joinable by code only").click()
  await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
  await expect(teacherPage.getByText("Success", { exact: true })).toBeVisible()

  // Chech that code can be generated
  await expect(teacherPage.getByText("/join?code=null")).toBeVisible()

  await teacherPage.getByRole("button", { name: "Generate join course link" }).click()
  await expect(teacherPage.getByText("/join?code=null")).toBeHidden()
  await expect(teacherPage.getByText("/join?code=")).toBeVisible()

  // Check that teacher can see the course page normally when the feature is enabled
  await teacherPage.goto(
    "http://project-331.local/org/uh-mathstat/courses/introduction-to-citations",
  )
  await selectCourseInstanceIfPrompted(teacherPage)
  await teacherPage.getByRole("heading", { name: "Welcome to..." }).click()

  // Change the course back to not joinable by code only
  await teacherPage.goto(
    "http://project-331.local/manage/courses/049061ba-ac30-49f1-aa9d-b7566dc22b78",
  )
  await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()
  await teacherPage.getByText("Joinable by code only").click()
  await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
})
