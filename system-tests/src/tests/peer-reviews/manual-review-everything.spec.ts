import { chromium, expect, Page, test } from "@playwright/test"

import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import waitForFunction from "../../utils/waitForFunction"

test.describe("test ManualReviewEverything behavior", () => {
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
  test.skip("ManualReviewEverything > That gets a perfect score gets sent to manual review", async ({
    headless,
  }) => {
    // Student 1 submits an answer
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page1).toHaveURL("http://project-331.local/org/uh-cs")
    await page1.getByRole("link", { name: "Navigate to course 'Advanced exercise states'" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states",
    )
    await page1.getByRole("radio", { name: "Default" }).check()
    await page1.getByRole("button", { name: "Continue" }).click()
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1",
    )
    await page1.getByRole("link", { name: "1 Page One" }).click()
    await expect(page1).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/page-1",
    )
    await page1.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).click()
    await page1.waitForTimeout(1000)

    // Student 2 submits an answer
    await page2.goto("http://project-331.local/")
    await page2
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page2).toHaveURL("http://project-331.local/org/uh-cs")
    await page2.getByRole("link", { name: "Navigate to course 'Advanced exercise states'" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states",
    )
    await page2.getByRole("radio", { name: "Default" }).check()
    await page2.getByRole("button", { name: "Continue" }).click()
    await page2.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1",
    )
    await page2.getByRole("link", { name: "1 Page One" }).click()
    await expect(page2).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/page-1",
    )
    await page2.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await page2.getByRole("button", { name: "Submit" }).click()
    await page2.waitForTimeout(1000)

    // Student 3 submits an answer
    await page3.goto("http://project-331.local/")
    await page3
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page3).toHaveURL("http://project-331.local/org/uh-cs")
    await page3.getByRole("link", { name: "Navigate to course 'Advanced exercise states'" }).click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states",
    )
    await page3.getByRole("radio", { name: "Default" }).check()
    await page3.getByRole("button", { name: "Continue" }).click()
    await page3.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1",
    )
    await page3.getByRole("link", { name: "1 Page One" }).click()
    await expect(page3).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/page-1",
    )
    await page3.frameLocator("iframe").getByRole("checkbox", { name: "c" }).click()
    await page3.getByRole("button", { name: "Submit" }).click()
    await page3.waitForTimeout(1000)

    // Student 1 starts peer review
    await page1.getByRole("button", { name: "Start peer review" }).click()
    await page1.getByPlaceholder("Write a review").click()
    await page1.getByPlaceholder("Write a review").fill("yes")
    await page1.getByRole("button", { name: "Submit" }).click()
    await page1.getByPlaceholder("Write a review").click()
    await page1.getByPlaceholder("Write a review").fill("kinda")
    await page1.getByRole("button", { name: "Submit" }).click()
    await page1.waitForTimeout(1000)

    // Student 2 starts peer review
    await page2.getByRole("button", { name: "Start peer review" }).click()
    await page2.getByPlaceholder("Write a review").click()
    await page2.getByPlaceholder("Write a review").fill("yes")
    await page2.getByRole("button", { name: "Submit" }).click()
    await page2.getByPlaceholder("Write a review").click()
    await page2.getByPlaceholder("Write a review").fill("kinda")
    await page2.getByRole("button", { name: "Submit" }).click()
    await page2.waitForTimeout(1000)

    // Student 3 starts peer review
    await page3.getByRole("button", { name: "Start peer review" }).click()
    await page3.getByPlaceholder("Write a review").click()
    await page3.getByPlaceholder("Write a review").fill("yes")
    await page3.getByRole("button", { name: "Submit" }).click()
    await page3.getByPlaceholder("Write a review").click()
    await page3.getByPlaceholder("Write a review").fill("kinda")
    await page3.getByRole("button", { name: "Submit" }).click()
    await page3.waitForTimeout(1000)

    // Teacher checks answers requiring attention
    await page4.goto("http://project-331.local/")
    await page4.waitForTimeout(1000)
    await page4
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await expect(page4).toHaveURL("http://project-331.local/org/uh-cs")
    await page4.getByRole("link", { name: "Manage course 'Advanced exercise states'" }).click()
    await expect(page4).toHaveURL(
      "http://project-331.local/manage/courses/0cf67777-0edb-480c-bdb6-13f90c136fc3",
    )
    await page4.getByRole("tab", { name: "Exercises" }).click()
    await expect(page4).toHaveURL(
      "http://project-331.local/manage/courses/0cf67777-0edb-480c-bdb6-13f90c136fc3/exercises",
    )
    await page4
      .locator('li:has-text("Best exercise View submissionsView answers requiring attention(3)")')
      .getByRole("link", { name: "View answers requiring attention" })
      .click()
    await expect(page4).toHaveURL(
      "http://project-331.local/manage/exercises/0f827be8-9043-576a-badd-868137143ee6/answers-requiring-attention",
    )
    await page4.waitForTimeout(1000)
    await page4.getByRole("button", { name: "Zero points" }).first().click()
    await page4.waitForTimeout(1000)
    await page4.getByRole("button", { name: "Full points" }).nth(1).click()
    await page4.waitForTimeout(1000)

    // Student 1 views his reviews and grading
    await page1.reload()
    await page1.getByText("Peer reviews received from other students2").click()

    // Student 2 views his reviews and grading
    await page2.reload()
    await page2.getByText("Peer reviews received from other students2").click()

    // Student 3 views his reviews and grading
    await page3.reload()
    await page3.getByText("Peer reviews received from other students2").click()
  })
})

test("ManualReviewEverything > That gets the worst score gets sent to manual review", async ({
  headless,
}) => {
  console.log("hello")
})
test("ManualReviewEverything > When an answer goes to manual review, the student won't get the points straight away", async ({
  headless,
}) => {
  console.log("hello")
})
test("ManualReviewEverything > When the teacher manually reviews an answer, the user gets the points after it", async ({
  headless,
}) => {
  console.log("hello")
})
test("ManualReviewEverything > If user submits multiple submissions to an exercise, and the answer goes to manual review after that, the manual review ui shows those submissions as grouped instead of two separate entries", async ({
  headless,
}) => {
  console.log("hello")
})
