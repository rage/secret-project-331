import { BrowserContext, expect, test } from "@playwright/test"

import { answerExercise } from "../peer-reviews/peer_review_utils"

import accessibilityCheck from "@/utils/accessibilityCheck"

const TEST_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/peer-review-accessibility-course/chapter-1/can-give-extra-reviews"

test.describe("Students should be able to navigate and select peer review radiobuttons", () => {
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

  test("Students can give peer reviews using keyboard", async () => {
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
    const strDisBut = student1Page.getByRole("radio", { name: "Strongly disagree" }).first()
    await expect(strDisBut).toBeVisible()
    await expect(strDisBut).toBeEnabled()
    await student1Page.getByPlaceholder("Write a review").press("Tab")
    await student1Page.keyboard.press("ArrowRight")
    await expect(
      student1Page.getByRole("radio", { name: "Disagree", exact: true }).first(),
    ).toBeFocused()
    await student1Page.keyboard.press(" ")
    await expect(student1Page.getByRole("radiogroup").first()).toMatchAriaSnapshot(`
    - radiogroup:
      - radio "Strongly disagree":
        - paragraph: Strongly disagree
      - radio "Disagree" [checked]:
        - paragraph: Disagree
      - radio "Neither agree nor disagree":
        - paragraph: Neither agree nor disagree
      - radio "Agree":
        - paragraph: Agree
      - radio "Strongly agree":
        - paragraph: Strongly agree
    `)

    await student1Page.keyboard.press("Tab")
    await student1Page.keyboard.press("ArrowRight")
    await student1Page.keyboard.press("ArrowRight")
    await student1Page.keyboard.press("ArrowRight")
    await expect(
      student1Page.getByRole("radio", { name: "Agree", exact: true }).nth(1),
    ).toBeFocused()
    await student1Page.keyboard.press(" ")
    await expect(student1Page.getByRole("radiogroup").nth(1)).toMatchAriaSnapshot(`
    - radiogroup:
      - radio "Strongly disagree":
        - paragraph: Strongly disagree
      - radio "Disagree":
        - paragraph: Disagree
      - radio "Neither agree nor disagree":
        - paragraph: Neither agree nor disagree
      - radio "Agree" [checked]:
        - paragraph: Agree
      - radio "Strongly agree":
        - paragraph: Strongly agree
    `)

    await accessibilityCheck(student1Page, "Peer review answering view")

    await context1.close()
  })
})
