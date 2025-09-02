import { BrowserContext, expect, test } from "@playwright/test"

import { answerExercise } from "../peer-reviews/peer_review_utils"

import accessibilityCheck from "@/utils/accessibilityCheck"

const TEST_PAGE =
  "http://project-331.local/org/uh-mathstat/courses/accessibility-course/chapter-1/can-give-extra-reviews"

test.describe("Students can give peer review using keyboard and screen reader", () => {
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

  test("Students can give peer review using keyboard and screen reader", async () => {
    // Setup test data
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

    // Tests: The multiple choice (5-step) scale cannot be operated using a keyboard. (WCAG 2.1.1)
    // and The selected option on the multiple-choice scale is not marked programmatically. Hence it is impossible to know which one is selected when using a screen reader. (WCAG 1.3.1)
    await student1Page.getByRole("button", { name: "Start peer review" }).click()
    await student1Page.getByRole("textbox", { name: "What are your thoughts on the" }).press("Tab")
    await student1Page.getByRole("radio", { name: "Strongly disagree" }).first().press("ArrowRight")
    await student1Page.getByRole("radio", { name: "Disagree", exact: true }).nth(1).press(" ")
    await expect(student1Page.getByRole("radio", { name: "Disagree", exact: true }).nth(1))
      .toMatchAriaSnapshot(`
      - radio "Disagree" [checked]
    `)
    await student1Page.getByRole("radio", { name: "Disagree", exact: true }).first().press("Tab")
    await student1Page.getByRole("radio", { name: "Strongly disagree" }).nth(1).press("ArrowRight")
    await student1Page
      .getByRole("radio", { name: "Disagree", exact: true })
      .nth(1)
      .press("ArrowRight")
    await student1Page.getByRole("radio", { name: "Disagree", exact: true }).nth(1).press(" ")
    await student1Page
      .getByRole("radio", { name: "Neither agree nor disagree" })
      .nth(1)
      .press("ArrowRight")
    await student1Page.getByRole("radio", { name: "Agree", exact: true }).nth(1).press(" ")
    await expect(student1Page.getByRole("radio", { name: "Agree", exact: true }).nth(1))
      .toMatchAriaSnapshot(`
      - radio "Agree" [checked]
    `)

    // Tests: The label of the comment field is not programmatically associated with the field. (WCAG 1.3.1, 4.1.2)
    const textAreaId = await student1Page
      .getByRole("textbox", { name: "What are your thoughts on the" })
      .getAttribute("id")
    expect(textAreaId).not.toBeNull()
    await expect(student1Page.getByText("What are your thoughts on the")).toHaveAttribute(
      "for",
      textAreaId as string,
    )

    // Tests: The peer review progress bar requires horizontal scrolling at a width of 320px. (WCAG 1.4.10)
    await student1Page.setViewportSize({ width: 320, height: 568 })
    const parent = student1Page
      .locator("div")
      .filter({ hasText: /^0 \/ 3 Peer reviews given$/ })
      .first()
    const parentBox = await parent.boundingBox()
    const bar = student1Page.locator(".css-1myg6bd")
    const barBox = await bar.boundingBox()
    expect(barBox).not.toBeNull()
    expect(parentBox).not.toBeNull()
    expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(parentBox!.x + parentBox!.width)

    await accessibilityCheck(student1Page, "Peer review answering view")

    await context1.close()
  })
})
