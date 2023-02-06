import { BrowserContext, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { fillPeerReview } from "./peer_review_utils"

test.describe("test AutomaticallyAcceptOrRejectByAverage behavior", () => {
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

  test("AutomaticallyAcceptOrRejectByAverage > Accepts", async ({ headless }) => {
    test.slow()
    const student1Page = await context1.newPage()
    const student2Page = await context2.newPage()
    const _teacherPage = await context3.newPage()

    // User 1 neavigates to exercise and answers
    await student1Page.goto("http://project-331.local/")
    await student1Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await student1Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await selectCourseInstanceIfPrompted(student1Page)
    await student1Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await student1Page.getByRole("link", { name: "3 Page Three" }).click()
    await student1Page.frameLocator("iframe").getByRole("checkbox", { name: "a" }).click()
    await student1Page.getByRole("button", { name: "Submit" }).click()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-submission",
      page: student1Page,
      clearNotifications: true,
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrRejectByAverage"'],
      scrollToYCoordinate: 0,
    })

    // User 2 neavigates to exercise and answers
    await student2Page.goto("http://project-331.local/")
    await student2Page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await student2Page
      .getByRole("link", { name: "Navigate to course 'Peer review Course'" })
      .click()
    await selectCourseInstanceIfPrompted(student2Page)
    await student2Page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await student2Page.getByRole("link", { name: "3 Page Three" }).click()
    await student2Page.frameLocator("iframe").getByRole("checkbox", { name: "b" }).click()
    await student2Page.getByRole("button", { name: "Submit" }).click()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-submission",
      page: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrRejectByAverage"'],
      scrollToYCoordinate: 0,
    })

    // User 1 writes reviews
    await fillPeerReview(student1Page, ["Agree", "Agree"])

    // User 2 writes reviews
    await fillPeerReview(student2Page, ["Disagree", "Disagree"])

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-peer-review",
      page: student1Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrRejectByAverage"'],
      scrollToYCoordinate: 0,
    })

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-peer-review",
      page: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrRejectByAverage"'],
      scrollToYCoordinate: 0,
    })

    await student1Page.reload()
    await student2Page.reload()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-seeing-score",
      page: student1Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrRejectByAverage"'],
      scrollToYCoordinate: 0,
    })

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-seeing-score",
      page: student2Page,
      clearNotifications: true,
      axeSkip: ["duplicate-id"],
      waitForThisToBeVisibleAndStable: ['text="AutomaticallyAcceptOrRejectByAverage"'],
      scrollToYCoordinate: 0,
    })
  })
})
