import { chromium, Page, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"

test.describe("test AutomaticallyAcceptOrManualReviewByAverage behavior", () => {
  let page1: Page
  let page2: Page
  let page3: Page
  let page4: Page
  test.beforeAll(async () => {
    const browser = await chromium.launch()

    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()
    const context4 = await browser.newContext()

    page1 = await context1.newPage()
    page2 = await context2.newPage()
    page3 = await context3.newPage()
    page4 = await context4.newPage()

    await logout(page1)
    await logout(page2)
    await logout(page3)
    await logout(page4)

    await login("student1@example.com", "student.1", page1, true)
    await login("student2@example.com", "student.2", page2, true)
    await login("student3@example.com", "student.3", page3, true)
    await login("teacher@example.com", "teacher", page4, true)
  })

  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("AutomaticallyAcceptOrManualReviewByAverage", async ({ page, headless }) => {
    // Student 1 answers a question
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page1)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page1.getByRole("link", { name: "2 Page 2" }).click()
    await page1.frameLocator("iframe >> nth=0").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).first().click()
    await page1.getByRole("button", { name: "Start peer review" }).click()

    // Student 2 answers a question
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page2)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page1.getByRole("link", { name: "2 Page 2" }).click()
    await page1.frameLocator("iframe >> nth=0").getByRole("checkbox", { name: "b" }).click()
    await page1.getByRole("button", { name: "Submit" }).first().click()
    await page1.getByRole("button", { name: "Start peer review" }).click()

    // Student 3 answers a question
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page3)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page1.getByRole("link", { name: "2 Page 2" }).click()
    await page1.frameLocator("iframe >> nth=0").getByRole("checkbox", { name: "c" }).click()
    await page1.getByRole("button", { name: "Submit" }).first().click()
    await page1.getByRole("button", { name: "Start peer review" }).click()
  })
})
