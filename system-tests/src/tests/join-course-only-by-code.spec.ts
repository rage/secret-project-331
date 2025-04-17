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
  const teacherPage = await context3.newPage()

  await test.step("Turn off join by code only feature", async () => {
    await teacherPage.goto(
      "http://project-331.local/manage/courses/39a52e8c-ebbf-4b9a-a900-09aa344f3691",
    )

    await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()
    await teacherPage.getByLabel("Edit course").getByText("Joinable by code only").click()
    await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
    await expect(teacherPage.getByText("Success", { exact: true })).toBeVisible()

    await expect(teacherPage.getByText("Generate join course link", { exact: true })).toBeHidden()
  })

  await test.step("Turn join by code only feature back on", async () => {
    await teacherPage.getByRole("button", { name: "Edit", exact: true }).click()
    await teacherPage.getByLabel("Edit course").getByText("Joinable by code only").click()
    await teacherPage.getByRole("button", { name: "Update", exact: true }).click()
    await expect(teacherPage.getByText("Success", { exact: true })).toBeVisible()

    await expect(teacherPage.getByText("Generate join course link", { exact: true })).toBeVisible()
  })

  let joinCode: string

  await test.step("Generate a new join code", async () => {
    await expect(teacherPage.getByRole("link", { name: "/join?code=" })).toBeVisible()
    await teacherPage.getByRole("button", { name: "Generate join course link" }).click()
    await teacherPage.getByText("Operation successful").waitFor()

    const joinCodeElement = teacherPage.getByRole("link", { name: "/join?code=" }).first()
    const joinCodeText = await joinCodeElement.textContent()
    // eslint-disable-next-line playwright/no-conditional-in-test
    joinCode = joinCodeText?.replace("/join?code=", "").trim() || ""

    expect(joinCode).not.toBe("")
  })

  await test.step("Student joins with the new code", async () => {
    await student1Page.goto(`http://project-331.local/join?code=${joinCode}`)
    await student1Page.getByRole("heading", { name: "Joinable by code only" }).click()
    await student1Page.getByRole("button", { name: "Yes" }).click()
  })

  await test.step("Verify student access with the new code", async () => {
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page.getByRole("heading", { name: "Welcome to..." }).click()
  })

  await test.step("Verify student2 (who hasn't used the code) cannot access the course directly", async () => {
    const student2Page = await context2.newPage()
    await student2Page.goto(
      "http://project-331.local/org/uh-mathstat/courses/joinable-by-code-only",
    )
    await student2Page.getByText("Unauthorized").first().waitFor()
  })
})
