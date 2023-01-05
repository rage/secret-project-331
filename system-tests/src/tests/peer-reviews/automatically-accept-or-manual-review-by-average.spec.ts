import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { fillPeerReview } from "./peer_review_utils"

test.describe("test AutomaticallyAcceptOrManualReviewByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })
  test("AutomaticallyAcceptOrManualReviewByAverage", async ({ headless, browser }) => {
    // Create contexts and pages
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()

    await logout(page1)
    await logout(page2)
    await logout(page3)

    await login("student1@example.com", "student.1", page1, true)
    await login("student2@example.com", "student.2", page2, true)
    await login("teacher@example.com", "teacher", page3, true)

    // Student 1 answers a question
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page1)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page1.getByRole("link", { name: "2 Page Two" }).click()
    await page1.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).click()

    // Student 2 answers a question
    await page2.goto("http://project-331.local/")
    await page2
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page2.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page2)
    await page2.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page2.getByRole("link", { name: "2 Page Two" }).click()
    await page2.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await page2.getByRole("button", { name: "Submit" }).click()

    // student 1 fills peerreviews
    await fillPeerReview(page1, ["Agree", "Agree"])

    // Student 2 fills peerreviews
    await fillPeerReview(page2, ["Disagree", "Disagree"])

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-not-seeing-score",
      page: page1,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      scrollToYCoordinate: 0,
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
    })

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-seeing-score",
      page: page2,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      scrollToYCoordinate: 0,
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
    })

    // Teacher reviews answers
    await page3.goto("http://project-331.local/")
    await page3
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page3.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await page3.goto("http://project-331.local/org/uh-cs")
    await page3.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await page3.getByRole("tab", { name: "Exercises" }).click()
    await page3
      .getByText("AutomaticallyAcceptOrManualReviewByAverage 1View answers requiring attention")
      .click()

    await page3.getByRole("button", { name: "Custom points" }).first().click()
    await page3.getByRole("spinbutton").fill("0.75")
    await page3.getByRole("button", { name: "Give custom points" }).click()
    await page3.reload()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-seeing-score",
      page: page1,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      scrollToYCoordinate: 0,
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
    })

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-seeing-score",
      page: page2,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      scrollToYCoordinate: 0,
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
    })
  })
})
