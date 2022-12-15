import { Page, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

/**
 *
 * @param page    Page, where peer review is filled
 * @param options Likert options chosen. First list in array is chosen likert options in first peer review and second list is answers for second peer review
 */
const fillPeerReview = async (page: Page, options: string[][]) => {
  await page.getByRole("button", { name: "Start peer review" }).click()
  await page.getByPlaceholder("Write a review").fill("It was hard to understand")
  await page
    .locator(
      `:nth-match(p:text-is('${options[0][0]}'):below(span:has-text('Was the answer correct? *')), 1)`,
    )
    .click()
  await page
    .locator(
      `:nth-match(p:text-is('${options[0][1]}'):below(span:has-text('Was the answer good? *')), 1)`,
    )
    .click()
  await page.getByRole("button", { name: "Submit" }).first().click()
  await page.getByPlaceholder("Write a review").fill("It was good")
  await page
    .locator(
      `:nth-match(p:text-is('${options[1][0]}'):below(span:has-text('Was the answer correct? *')), 1)`,
    )
    .click()
  await page
    .locator(
      `:nth-match(p:text-is('${options[1][1]}'):below(span:has-text('Was the answer good? *')), 1)`,
    )
    .click()
  await page.getByRole("button", { name: "Submit" }).first().click()
}

test.describe("test AutomaticallyAcceptOrManualReviewByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("AutomaticallyAcceptOrManualReviewByAverage", async ({ headless, browser }) => {
    // Create contexts and pages
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()
    const context4 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()
    const page4 = await context4.newPage()

    await logout(page1)
    await logout(page2)
    await logout(page3)
    await logout(page4)

    await login("student1@example.com", "student.1", page1, true)
    await login("student2@example.com", "student.2", page2, true)
    await login("student3@example.com", "student.3", page3, true)
    await login("teacher@example.com", "teacher", page4, true)

    // Student 1 answers a question
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page1)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page1.getByRole("link", { name: "2 Page 2" }).click()
    await page1
      .frameLocator("iframe >> nth=0")
      .getByRole("checkbox", { name: "a", exact: true })
      .click()
    await page1.getByRole("button", { name: "Submit" }).first().click()

    // Student 2 answers a question
    await page2.goto("http://project-331.local/")
    await page2
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page2.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page2)
    await page2.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page2.getByRole("link", { name: "2 Page 2" }).click()
    await page2
      .frameLocator("iframe >> nth=0")
      .getByRole("checkbox", { name: "b", exact: true })
      .click()
    await page2.getByRole("button", { name: "Submit" }).first().click()

    // Student 3 answers a question
    await page3.goto("http://project-331.local/")
    await page3
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page3.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page3)
    await page3.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page3.getByRole("link", { name: "2 Page 2" }).click()
    await page3
      .frameLocator("iframe >> nth=0")
      .getByRole("checkbox", { name: "c", exact: true })
      .click()
    await page3.getByRole("button", { name: "Submit" }).first().click()

    // students fills peerreviews
    await fillPeerReview(page1, [
      ["Disagree", "Disagree"],
      ["Neither agree nor disagree", "Neither agree nor disagree"],
    ])
    await fillPeerReview(page2, [
      ["Disagree", "Disagree"],
      ["Neither agree nor disagree", "Neither agree nor disagree"],
    ])
    await fillPeerReview(page3, [
      ["Disagree", "Disagree"],
      ["Disagree", "Disagree"],
    ])

    await page1.reload()
    await page2.reload()
    await page3.reload()

    // Teacher reviews answers
    await page4.goto("http://project-331.local/")
    await page4
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page4.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await page4.goto("http://project-331.local/org/uh-cs")
    await page4.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await page4.getByRole("tab", { name: "Exercises" }).click()
    await page4
      .getByRole("listitem")
      .filter({ hasText: "Best exercise View submissionsView answers requiring attention(1)" })
      .getByRole("link", { name: "View answers requiring attention" })
      .click()

    await page4.getByRole("button", { name: "Custom points" }).first().click()
    await page4.getByRole("spinbutton").fill("0.75")
    await page4.getByRole("button", { name: "Give custom points" }).click()
    await page4.reload()

    await page1.reload()
    await page1.getByText("First chapters second page").waitFor()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-seeing-score",
      page: page1,
      clearNotifications: true,
      axeSkip: true,
    })

    await page2.reload()
    await page2.getByText("First chapters second page").waitFor()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-seeing-score",
      page: page2,
      clearNotifications: true,
      axeSkip: true,
    })

    await page3.reload()
    await page3.getByText("First chapters second page").waitFor()
    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-3-seeing-score",
      page: page3,
      clearNotifications: true,
      axeSkip: true,
    })
  })
})
