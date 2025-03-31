import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.describe("Peer review followed by self review works", () => {
  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext
  let context4: BrowserContext

  test.beforeEach(async ({ browser }) => {
    ;[context1, context2, context3, context4] = await Promise.all([
      browser.newContext({ storageState: "src/states/teacher@example.com.json" }),
      browser.newContext({ storageState: "src/states/student1@example.com.json" }),
      browser.newContext({ storageState: "src/states/student2@example.com.json" }),
      browser.newContext({ storageState: "src/states/student3@example.com.json" }),
    ])
  })

  test.afterEach(async () => {
    await Promise.all([context1.close(), context2.close(), context3.close(), context4.close()])
  })

  test("Peer review followed by self review works", async () => {
    const teacherPage = await context1.newPage()
    const student1Page = await context2.newPage()
    const student2Page = await context3.newPage()
    const student3Page = await context4.newPage()

    await test.step(`Configuring the self review exercise, using the non-inline course default editor`, async () => {
      await teacherPage.goto("http://project-331.local/")
      await teacherPage.getByRole("link", { name: "All organizations" }).click()
      await teacherPage
        .getByLabel("University of Helsinki, Department of Mathematics and Statistics")
        .click()
      await teacherPage.getByLabel("Manage course 'Self review'").click()
      await teacherPage.getByRole("tab", { name: "Pages" }).click()
      await teacherPage
        .getByRole("row", { name: "The timeline /chapter-1/the-" })
        .getByRole("button")
        .first()
        .click()
      await teacherPage.getByText("Peer and self review").click()
      await teacherPage.getByText("Add peer review").click()
      await teacherPage.getByText("Add self review").click()
      await teacherPage.getByRole("button", { name: "Save", exact: true }).click()
      await teacherPage.getByText("Operation successful!").waitFor()
      await teacherPage.getByText("Peer and self review").click()
      const page1Promise = teacherPage.waitForEvent("popup")
      await teacherPage.getByRole("link", { name: "Course default peer review" }).click()
      const page1 = await page1Promise
      await page1.getByLabel("Add default block").click()
      await page1.getByLabel("Empty block; start writing or").fill("Here's what you will do: x.")
      await page1
        .getByLabel("Peer review questionThe answer was easy to read")
        .fill("The answer was hard to read")
      await page1
        .getByLabel("Peer review questionThe answer was correct")
        .fill("The answer was incorrect")
      await page1.getByRole("button", { name: "Save" }).click()
      await page1.getByText("Operation successful!").waitFor()
      await page1.getByLabel("Peer reviews to receive *").fill("1")
      await page1.getByLabel("Peer reviews to give *").fill("2")
      await page1.getByRole("button", { name: "Save" }).click()
      await page1.getByText("Operation successful!").waitFor()
    })

    await test.step(`Student 1 answers the exercise and starts peer review`, async () => {
      await student1Page.goto(
        "http://project-331.local/org/uh-mathstat/courses/self-review/chapter-1/the-timeline",
      )
      await selectCourseInstanceIfPrompted(student1Page)
      await student1Page.getByText("After you submit this").waitFor()
      await student1Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("1995")
        .selectOption({ label: "Finland joins the European Union" })
      await student1Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("1998")
        .selectOption({
          label: "Finland joins the Economic and Monetary Union of the European Union",
        })
      await student1Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("2002")
        .selectOption({ label: "Finland switches their currency to Euro" })
      await student1Page.getByRole("button", { name: "Submit" }).click()
      await student1Page.getByRole("button", { name: "Start peer review" }).click()
      await student1Page.getByText("No answers available to peer review").waitFor()
    })

    await test.step(`Student 2 answers the exercise and starts peer review`, async () => {
      await student2Page.goto(
        "http://project-331.local/org/uh-mathstat/courses/self-review/chapter-1/the-timeline",
      )
      await selectCourseInstanceIfPrompted(student2Page)
      await student2Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("1995")
        .selectOption({ label: "Finland joins the European Union" })
      await student2Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("1998")
        .selectOption({
          label: "Finland joins the Economic and Monetary Union of the European Union",
        })
      await student2Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("2002")
        .selectOption({ label: "Finland switches their currency to Euro" })
      await student2Page.getByRole("button", { name: "Submit" }).click()
      await student2Page.getByRole("button", { name: "Start peer review" }).click()
      await student2Page.getByText("0 / 2 Peer reviews given").waitFor()
      await student2Page.getByRole("heading", { name: "Peer review instructions" }).waitFor()
      await student2Page.getByText("Here's what you will do: x.").waitFor()
      await student2Page.getByRole("heading", { name: "Answer submitted by another" }).waitFor()
      await student2Page.getByPlaceholder("Write a review").fill("Best answer of our generation!")
      await student2Page.getByText("Agree", { exact: true }).first().click()
      await student2Page
        .locator("div")
        .filter({ hasText: /^Disagree$/ })
        .nth(1)
        .click()
      await student2Page.getByRole("button", { name: "Submit" }).click()
      await student2Page.getByText("Operation successful!").waitFor()
      await student2Page.getByText("No answers available to peer review").waitFor()
    })

    await test.step(`Student 3 answers the exercise and does the peer reviews`, async () => {
      await student3Page.goto(
        "http://project-331.local/org/uh-mathstat/courses/self-review/chapter-1/the-timeline",
      )
      await selectCourseInstanceIfPrompted(student3Page)
      await student3Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("1995")
        .selectOption({ label: "Finland joins the European Union" })
      await student3Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("1998")
        .selectOption({
          label: "Finland joins the Economic and Monetary Union of the European Union",
        })
      await student3Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByLabel("2002")
        .selectOption({ label: "Finland switches their currency to Euro" })
      await student3Page.getByRole("button", { name: "Submit" }).click()
      await student3Page
        .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
        .getByText("Your answer was correct.")
        .waitFor()
      await student3Page.getByRole("button", { name: "Start peer review" }).click()
      await student3Page.getByText("Agree", { exact: true }).first().click()
      await student3Page
        .locator("div")
        .filter({ hasText: /^Agree$/ })
        .nth(1)
        .click()
      await student3Page.getByRole("button", { name: "Submit" }).click()
      await student3Page
        .locator("div")
        .filter({ hasText: /^Agree$/ })
        .first()
        .click()
      await student3Page
        .locator("div")
        .filter({ hasText: /^Agree$/ })
        .nth(1)
        .click()
      await student3Page.getByPlaceholder("Write a review").fill("LOL")
      await student3Page.getByRole("button", { name: "Submit" }).click()
    })

    await test.step(`Student 3 self reviews`, async () => {
      await student3Page.getByRole("heading", { name: "Self review", exact: true }).waitFor()
      await student3Page.getByRole("heading", { name: "Self review instructions" }).waitFor()
      await student3Page.getByText("Here's what you will do: x.").waitFor()
      await student3Page
        .getByPlaceholder("Write a review")
        .fill("I agree with myself. I am the best!")
      await student3Page
        .locator("div")
        .filter({ hasText: /^Strongly agree$/ })
        .first()
        .click()
      await student3Page
        .locator("div")
        .filter({ hasText: /^Strongly disagree$/ })
        .nth(1)
        .click()
      await student3Page.getByRole("button", { name: "Submit" }).click()
      await student3Page.getByText("Operation successful!").waitFor()
      await student3Page.getByText("Waiting for other students to review your answer").waitFor()
    })

    await test.step(`Student 1 reviews student 3's answer`, async () => {
      await student1Page.getByRole("button", { name: "Refresh" }).click()
      await student1Page.getByPlaceholder("Write a review").fill("Good point. I agree with you.")
      await student1Page
        .locator("div")
        .filter({ hasText: /^Strongly agree$/ })
        .first()
        .click()
      await student1Page
        .locator("div")
        .filter({ hasText: /^Agree$/ })
        .nth(1)
        .click()
      await student1Page.getByRole("button", { name: "Submit" }).click()
      await student1Page.getByText("Operation successful!").waitFor()
    })

    await test.step(`Student 3 sees their results`, async () => {
      await student3Page.reload()
      await student3Page
        .getByText(
          "Your answer has been reviewed and graded. New submissions are no longer allowed.",
        )
        .waitFor()
      await expect(student3Page.getByTestId("exercise-points")).toContainText("1/1")
      await student3Page.getByText("Received reviews").click()
      await student3Page
        .getByLabel("Exercise:Best quizzes exercise")
        .getByText("Self review")
        .waitFor()
      await student3Page.getByText("I agree with myself. I am the best!").waitFor()
      await student3Page.getByText("Peer review #1").waitFor()
      await student3Page.getByText("Good point. I agree with you.").waitFor()
    })
  })
})
