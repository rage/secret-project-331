import { BrowserContext, expect, test } from "@playwright/test"

import { answerExercise } from "../peer-reviews/peer_review_utils"

import accessibilityCheck from "@/utils/accessibilityCheck"

const TEST_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/can-give-extra-reviews"

test.describe("Students should be able to give extra peer reviews to receive priority", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
    context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
    context3 = await browser.newContext({ storageState: "src/states/student3@example.com.json" })
  })

  test.afterEach(async () => {
    await context1.close()
    await context2.close()
    await context3.close()
  })

  test("Students can give more peer reviews than necessary", async () => {
    test.slow()
    const [student1Page, student2Page, student3Page] = await Promise.all([
      context1.newPage(),
      context2.newPage(),
      context3.newPage(),
    ])

    await Promise.all([
      answerExercise(student1Page, TEST_PAGE, "a"),
      answerExercise(student2Page, TEST_PAGE, "b"),
      answerExercise(student3Page, TEST_PAGE, "c"),
    ])

    await Promise.all([context2.close(), context3.close()])

    await student1Page.getByRole("button", { name: "Start peer review" }).click()
    await student1Page.getByPlaceholder("Write a review").press("Tab")
    await student1Page
      .getByRole("button", { name: "Strongly disagree" })
      .first()
      .press("ArrowRight")
    await student1Page.getByRole("button", { name: "Disagree", exact: true }).nth(1).press(" ")
    await student1Page.getByRole("button", { name: "Disagree", exact: true }).first().press("Tab")
    await student1Page.getByRole("button", { name: "Strongly disagree" }).nth(1).press("ArrowRight")
    await student1Page
      .getByRole("button", { name: "Disagree", exact: true })
      .nth(1)
      .press("ArrowRight")
    await student1Page.getByRole("button", { name: "Disagree", exact: true }).nth(1).press(" ")
    await student1Page
      .getByRole("button", { name: "Neither agree nor disagree" })
      .nth(1)
      .press("ArrowRight")
    await student1Page.getByRole("button", { name: "Disagree", exact: true }).nth(1).press(" ")

    await accessibilityCheck(student1Page, "Peer review answering view")

    await context1.close()
  })
})
