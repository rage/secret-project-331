import { BrowserContext, expect, test } from "@playwright/test"

import { answerExercise, fillPeerReview } from "./peer-review-utils"

const TEST_PAGE =
  "http://project-331.local/org/uh-cs/courses/peer-review-course/chapter-1/can-give-extra-reviews"

test.describe("Students should be able to give extra peer reviews to receive priority", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext
  let context4: BrowserContext
  let context5: BrowserContext
  let context6: BrowserContext

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
    context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
    context3 = await browser.newContext({ storageState: "src/states/student3@example.com.json" })
    context4 = await browser.newContext({ storageState: "src/states/student4@example.com.json" })
    context5 = await browser.newContext({ storageState: "src/states/student5@example.com.json" })
    context6 = await browser.newContext({
      storageState: "src/states/admin@example.com.json",
    })
  })

  test.afterEach(async () => {
    await context1.close()
    await context2.close()
    await context3.close()
    await context4.close()
    await context5.close()
    await context6.close()
  })

  test("Students can give more peer reviews than necessary", async () => {
    test.slow()
    const [student1Page, student2Page, student3Page, student4Page, student5Page] =
      await Promise.all([
        context1.newPage(),
        context2.newPage(),
        context3.newPage(),
        context4.newPage(),
        context5.newPage(),
      ])

    await Promise.all([
      answerExercise(student1Page, TEST_PAGE, "a"),
      answerExercise(student2Page, TEST_PAGE, "b"),
      answerExercise(student3Page, TEST_PAGE, "c"),
      answerExercise(student4Page, TEST_PAGE, "a"),
      answerExercise(student5Page, TEST_PAGE, "b"),
    ])

    await Promise.all([context2.close(), context3.close(), context4.close(), context5.close()])
    await fillPeerReview(student1Page, ["Agree", "Agree"])
    await student1Page.getByText("1 / 3 Peer reviews given").waitFor()
    await fillPeerReview(student1Page, ["Agree", "Agree"], false)
    await student1Page.getByText("2 / 3 Peer reviews given").waitFor()
    await fillPeerReview(student1Page, ["Agree", "Agree"], false)
    await test.step("User should be able to give an extra peer review to speed up the process", async () => {
      await student1Page.getByRole("button", { name: "Give extra peer review" }).click()
      await student1Page.getByText("3 / 3 Peer reviews given").waitFor()
      await fillPeerReview(student1Page, ["Agree", "Agree"], false)
      await student1Page.getByRole("button", { name: "Give extra peer review" }).click()
      await student1Page.getByText("No answers available to peer review yet").waitFor()
      await context1.close()
    })

    await test.step("Admins should see that student 1 has priority 3", async () => {
      const adminPage = await context6.newPage()
      await adminPage.goto("http://project-331.local/")
      await adminPage.getByRole("link", { name: "Search users" }).click()
      await adminPage.getByLabel("User email or name", { exact: true }).click()
      await adminPage.getByLabel("User email or name", { exact: true }).fill("student1@example.com")
      await adminPage.getByRole("button", { name: "Search" }).click()
      await adminPage
        .getByRole("row", { name: "02364d40-2aac-4763-8a06-" })
        .getByRole("button")
        .click()
      await adminPage
        .getByTestId("course-status-card")
        .filter({ hasText: "Peer review Course" })
        .getByRole("button", { name: "Course status summary" })
        .click()

      const exerciseDetailsComponent = adminPage
        .getByTestId("exercise-status")
        .filter({ hasText: "Can give extra" })

      await exerciseDetailsComponent.getByRole("button", { name: "View details" }).click()

      await expect(exerciseDetailsComponent).toContainText("Priority: 4")
    })
  })
})
