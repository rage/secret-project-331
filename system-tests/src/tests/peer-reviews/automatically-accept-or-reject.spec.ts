import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { login } from "../../utils/login"
import { logout } from "../../utils/logout"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { fillPeerReview } from "./peer_review_utils"

test.describe("test AutomaticallyAcceptOrRejectByAverage behavior", () => {
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test("AutomaticallyAcceptOrRejectByAverage > Accepts", async ({ headless, browser }) => {
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

    // User 1 neavigates to exercise and answers
    await page1.goto("http://project-331.local/")
    await page1
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page1.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page1)
    await page1.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page1.getByRole("link", { name: "2 Page 2" }).click()
    await page1.frameLocator("iframe >> nth=1").getByRole("checkbox", { name: "a" }).click()
    await page1.getByRole("button", { name: "Submit" }).nth(1).click()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-submission",
      page: page1,
      clearNotifications: true,
      axeSkip: true,
    })

    // User 2 neavigates to exercise and answers
    await page2.goto("http://project-331.local/")
    await page2
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click()
    await page2.getByRole("link", { name: "Navigate to course 'Peer review Course'" }).click()
    await selectCourseInstanceIfPrompted(page2)
    await page2.getByRole("link", { name: "Chapter 1 The Basics" }).click()
    await page2.getByRole("link", { name: "2 Page 2" }).click()
    await page2.frameLocator("iframe >> nth=1").getByRole("checkbox", { name: "b" }).click()
    await page2.getByRole("button", { name: "Submit" }).nth(1).click()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-submission",
      page: page2,
      clearNotifications: true,
      axeSkip: true,
    })

    // User 1 writes reviews
    await fillPeerReview(page1, ["Disagree", "Disagree"])

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-after-peer-review",
      page: page1,
      clearNotifications: true,
      axeSkip: true,
    })

    // User 2 writes reviews
    await fillPeerReview(page2, ["Agree", "Agree"])

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-after-peer-review",
      page: page2,
      clearNotifications: true,
      axeSkip: true,
    })

    await page1.reload()
    await page2.reload()

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-1-seeing-score",
      page: page1,
      clearNotifications: true,
      axeSkip: true,
    })

    await expectScreenshotsToMatchSnapshots({
      headless,
      snapshotName: "student-2-seeing-score",
      page: page2,
      clearNotifications: true,
      axeSkip: true,
    })
  })
})
