import { chromium, expect, Page, test } from "@playwright/test"

import { login } from "../../utils/login"
import { logout } from "../../utils/logout"

test.describe("test AutomaticallyAcceptOrRejectByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

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
  test("AutomaticallyAcceptOrRejectByAverage > Accepts", async ({ page, headless }) => {
    // User 1 neavigates to exercise and answers
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs")
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await page1.getByRole("radio", { name: "Default" }).check()
    await page1.getByRole("button", { name: "Continue" }).click()
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page1.getByRole("link", { name: "2 Page 2" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-2",
    )
    await page1.frameLocator("iframe >> nth=0").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).first().click()
    await page1.getByRole("button", { name: "Start peer review" }).click()

    // User 2 neavigates to exercise and answers
    await page2.goto("http://project-331.local/")
    await page2
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs")
    await page2.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await page2.getByRole("radio", { name: "Default" }).check()
    await page2.getByRole("button", { name: "Continue" }).click()
    await page2.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page2.getByRole("link", { name: "2 Page 2" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-2",
    )
    await page2.frameLocator("iframe >> nth=0").getByRole("checkbox", { name: "b" }).click()
    await page2.getByRole("button", { name: "Submit" }).first().click()
    await page2.getByRole("button", { name: "Start peer review" }).click()

    // User 3 neavigates to exercise and answers
    await page3.goto("http://project-331.local/")
    await page3
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs")
    await page3.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs/courses/peer-review-course")
    await page3.getByRole("radio", { name: "Default" }).check()
    await page3.getByRole("button", { name: "Continue" }).click()
    await page3.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1",
    )
    await page3.getByRole("link", { name: "2 Page 2" }).click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/page-2",
    )
    await page3.frameLocator("iframe >> nth=0").getByRole("checkbox", { name: "c" }).click()
    await page3.getByRole("button", { name: "Submit" }).first().click()
    await page3.getByRole("button", { name: "Start peer review" }).click()

    // User 1 writes reviews
    await page1.reload()
    await page1.getByPlaceholder("Write a review").click()
    await page1.getByPlaceholder("Write a review").fill("yes")
    await page1.getByRole("button", { name: "Submit" }).first().click()
    await page1.getByPlaceholder("Write a review").click()
    await page1.getByPlaceholder("Write a review").fill("no")
    await page1.getByRole("button", { name: "Submit" }).first().click()

    // User 2 writes reviews
    await page2.reload()
    await page2.getByPlaceholder("Write a review").click()
    await page2.getByPlaceholder("Write a review").fill("yes")
    await page2.getByRole("button", { name: "Submit" }).first().click()
    await page2.getByPlaceholder("Write a review").click()
    await page2.getByPlaceholder("Write a review").fill("no")
    await page2.getByRole("button", { name: "Submit" }).first().click()

    // User 3 writes reviews
    await page3.reload()
    await page3.getByPlaceholder("Write a review").click()
    await page3.getByPlaceholder("Write a review").fill("yes")
    await page3.getByRole("button", { name: "Submit" }).first().click()
    await page3.getByPlaceholder("Write a review").click()
    await page3.getByPlaceholder("Write a review").fill("no")
    await page3.getByRole("button", { name: "Submit" }).first().click()

    await page1.reload()
    await page2.reload()
    await page3.reload()
  })
})
