import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { scrollLocatorsParentIframeToViewIfNeeded } from "../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("quizzes, after wrong answer modify only the incorrect choice and resubmit", async ({
  page,
  headless,
}, testInfo) => {
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Navigate to course 'Advanced exercise states'" }).click()
  await selectCourseInstanceIfPrompted(page)
  await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await page.getByRole("link", { name: "12 Complicated quizzes exercise page" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page.locator("id=be169e81-f217-5bee-8475-2d94a5c67045"),
    headless,
    testInfo,
    snapshotName: "before-answering-resubmitting-test",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })
  await scrollLocatorsParentIframeToViewIfNeeded(
    page
      .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
      .getByRole("button", { name: "Incorrect" }),
  )
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("button", { name: "Correct" })
    .first()
    .click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 2 content"]')
    .getByRole("button", { name: "Correct" })
    .first()
    .click()
  await scrollLocatorsParentIframeToViewIfNeeded(
    page
      .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
      .getByRole("button", { name: "Incorrect" }),
  )
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByRole("button", { name: "Incorrect" })
    .click()

  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Try again").waitFor()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByText("Waiting for content")
    .waitFor({ state: "detached" })
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 2 content"]')
    .getByText("Waiting for content")
    .waitFor({ state: "detached" })
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByText("Waiting for content")
    .waitFor({ state: "detached" })
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "after-answering-resubmitting-test",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })
  await page.getByRole("button", { name: "try again" }).click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByRole("button", { name: "Correct" })
    .nth(2)
    .click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "resubmit-before-answering-resubmitting-test",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })
  await page.getByRole("button", { name: "Submit" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "resubmit-after-answering-resubmitting-test",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=First question.`),
      page.locator(`text=Second question.`),
      page.locator(`text=Third question.`),
    ],
  })
})
