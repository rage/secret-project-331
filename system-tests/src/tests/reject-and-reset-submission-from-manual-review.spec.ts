import { BrowserContext, expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

let context1: BrowserContext
let context2: BrowserContext
let context3: BrowserContext

test.beforeEach(async ({ browser }) => {
  context1 = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
  context2 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
  context3 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
})

test.afterEach(async () => {
  await context1.close()
  await context2.close()
  await context3.close()
})

test("Reject and reset submission", async () => {
  test.slow()
  const teacherPage = await context1.newPage()
  const student1Page = await context2.newPage()
  const student2Page = await context3.newPage()

  await test.step("Teacher can reject and reset user submission from manual review", async () => {
    await teacherPage.goto(
      "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/pages",
    )
    await teacherPage
      .getByRole("row", { name: "Page One /chapter-1/page-1" })
      .getByRole("button")
      .first()
      .click()

    await teacherPage.getByRole("button", { name: "Add block" }).click()
    await teacherPage.getByRole("searchbox", { name: "Search" }).fill("exer")
    await teacherPage.getByRole("option", { name: "Exercise", exact: true }).click()
    await teacherPage
      .getByRole("textbox", { name: "Exercise namefalse" })
      .nth(1)
      .fill("Test Exercise")
    await teacherPage.getByRole("checkbox", { name: "Limit number of tries" }).nth(1).click()
    await teacherPage.getByRole("spinbutton", { name: "Max tries per slidefalse" }).nth(1).fill("1")

    await teacherPage.getByText("Peer and self review").nth(1).click()
    await teacherPage.getByRole("checkbox", { name: "Add peer review" }).check()
    await teacherPage.getByRole("spinbutton", { name: "Peer reviews to receive (" }).fill("1")
    await teacherPage.getByRole("spinbutton", { name: "Peer reviews to give (" }).fill("2")
    await teacherPage.getByRole("button", { name: "Add peer review question" }).click()
    await teacherPage.getByLabel("Peer review question type").nth(1).selectOption("Scale")
    await teacherPage.getByRole("textbox", { name: "Peer review question" }).fill("Good answer?")

    await teacherPage.getByRole("button", { name: "Edit" }).nth(1).click()
    await teacherPage.getByRole("button", { name: "Edit" }).nth(1).click()
    await teacherPage.getByRole("button", { name: "Quizzes" }).click()

    await teacherPage
      .frameLocator('iframe[title="IFRAME EDITOR"]')
      .getByRole("button", { name: "Essay For writing essays or" })
      .click()

    await teacherPage.getByRole("button", { name: "Save", exact: true }).click()
    await expect(teacherPage.getByText("Operation successful!")).toBeVisible()
  })

  await test.step("Students and teacher can submit answers", async () => {
    // Student1 answers the exercise
    await student1Page.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page
      .frameLocator('iframe[title="Exercise 2, task 1 content"]')
      .getByRole("textbox", { name: "Answer" })
      .fill("Student1 answer")
    await student1Page
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student1Page.getByText("Start peer review")).toBeVisible()

    // Student2 answers the exercise
    await student2Page.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student2Page)
    await student2Page
      .frameLocator('iframe[title="Exercise 2, task 1 content"]')
      .getByRole("textbox", { name: "Answer" })
      .fill("Student2 answer")
    await student2Page
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student2Page.getByText("Start peer review")).toBeVisible()

    // Teacher answers the exercise
    await teacherPage.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(teacherPage)
    await teacherPage
      .frameLocator('iframe[title="Exercise 2, task 1 content"]')
      .getByRole("textbox", { name: "Answer" })
      .fill("Teachers answer")
    await teacherPage
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(teacherPage.getByText("Start peer review")).toBeVisible()
  })

  await test.step("Students and teacher can peer review each other", async () => {
    //Student1 gets a bad review from both so the submission will be moved to manual review

    // Student1 peer reviews Student2 and Teachers answers
    await student1Page.getByRole("button", { name: "Start peer review" }).click()
    await student1Page.getByRole("radio", { name: "Strongly agree" }).click()
    await student1Page
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await student1Page.getByRole("radio", { name: "Strongly agree" }).click()
    await student1Page
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(
      student1Page.getByRole("heading", { name: "Waiting for peer reviews" }),
    ).toBeVisible()

    // Student2 peer reviews Student1 and Teachers answers
    await student2Page.getByRole("button", { name: "Start peer review" }).click()
    await student2Page.getByRole("radio", { name: "Strongly disagree" }).click()
    await student2Page
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await student2Page.getByRole("radio", { name: "Strongly disagree" }).click()
    await student2Page
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student2Page.getByText("Your answer has been reviewed")).toBeVisible()

    // Teacher peer reviews Student1 and Student2 answers
    await teacherPage.getByRole("button", { name: "Start peer review" }).click()
    await teacherPage.getByRole("radio", { name: "Strongly disagree" }).click()
    await teacherPage
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await teacherPage.getByRole("radio", { name: "Strongly disagree" }).click()
    await teacherPage
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
  })

  await test.step("Teacher can reject and reset Student1 submission", async () => {
    await teacherPage.goto(
      "http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/exercises",
    )
    await teacherPage.getByRole("link", { name: "View answers requiring" }).click()
    await teacherPage.locator(".css-xknul2-TopBar").first().click()
    await teacherPage.getByRole("button", { name: "Reject and reset" }).first().click()
    await expect(teacherPage.getByText("Operation successful!")).toBeVisible()
  })

  await test.step("Student1 can resubmit after rejection and it does not affect Student2 points or given peer reviews", async () => {
    //Student1 can redo the essay and peer review
    await student1Page.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page
      .frameLocator('iframe[title="Exercise 2, task 1 content"]')
      .getByRole("textbox", { name: "Answer" })
      .fill("Student1 resubmitted answer")
    await student1Page
      .getByLabel("Exercise:Test Exercise")
      .getByRole("button", { name: "Submit" })
      .click()
    await expect(student1Page.getByText("Start peer review")).toBeVisible()

    // Student2 still has reviews preserved
    await student2Page.goto(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-1",
    )
    await expect(student2Page.getByText("Your answer has been reviewed")).toBeVisible()
  })
})
