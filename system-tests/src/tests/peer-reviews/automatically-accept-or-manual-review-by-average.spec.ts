import { BrowserContext, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { fillPeerReview } from "./peer_review_utils"

test.describe("test AutomaticallyAcceptOrManualReviewByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  let context1: BrowserContext
  let context2: BrowserContext
  let context3: BrowserContext

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext({ storageState: "src/states/student1@example.com.json" })
    context2 = await browser.newContext({ storageState: "src/states/student2@example.com.json" })
    context3 = await browser.newContext({ storageState: "src/states/teacher@example.com.json" })
  })

  test.afterEach(async () => {
    await context1.close()
    await context2.close()
    await context3.close()
  })
  test("AutomaticallyAcceptOrManualReviewByAverage", async ({ headless }) => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const teacherPage = await context3.newPage()

    // Student 1 answers a question
    await student1Page.goto("http://project-331.local/")
    await student1Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await student1Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await student1Page.getByRole("link", { name: "2 Page Two" }).click()
    await student1Page.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await student1Page.getByRole("button", { name: "Submit" }).click()

    // Student 2 answers a question
    await student2Page.goto("http://project-331.local/")
    await student2Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await student2Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await selectCourseInstanceIfPrompted(student2Page)
    await student2Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await student2Page.getByRole("link", { name: "2 Page Two" }).click()
    await student2Page.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await student2Page.getByRole("button", { name: "Submit" }).click()

    // student 1 fills peerreviews
    await fillPeerReview(student1Page, ["Agree", "Agree"])

    // Student 2 fills peerreviews
    await fillPeerReview(student2Page, ["Disagree", "Disagree"])

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-not-seeing-score",
      page: student1Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
      scrollToYCoordinate: 0,
    })

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-seeing-score",
      page: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
      scrollToYCoordinate: 0,
    })

    // Teacher reviews answers
    await teacherPage.goto("http://project-331.local/")
    await teacherPage
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await teacherPage.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await teacherPage.goto("http://project-331.local/org/uh-cs")
    await teacherPage.getByRole("link", { name: "Manage course 'Peer review Course'" }).click()
    await teacherPage.getByRole("tab", { name: "Exercises" }).click()
    await teacherPage
      .getByText("AutomaticallyAcceptOrManualReviewByAverage 1View answers requiring attention")
      .click()

    await teacherPage.getByRole("button", { name: "Custom points" }).first().click()
    await teacherPage.getByRole("spinbutton").fill("0.75")
    await teacherPage.getByRole("button", { name: "Give custom points" }).click()
    await teacherPage.reload()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-seeing-score",
      page: student1Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
      scrollToYCoordinate: 0,
    })

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-seeing-score",
      page: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrManualReviewByAverage"'],
      scrollToYCoordinate: 0,
    })
  })
})
