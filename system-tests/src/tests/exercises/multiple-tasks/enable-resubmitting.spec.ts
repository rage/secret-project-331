import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { scrollLocatorsParentIframeToViewIfNeeded } from "../../utils/iframeLocators"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("quizzes, after wrong answer modify only the incorrect choice and resubmit", async ({
  page,
}) => {
  await page.goto("http://project-331.local/organizations")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Navigate to course 'Advanced exercise states'" }).click()
  await selectCourseInstanceIfPrompted(page)
  await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await page.getByRole("link", { name: "12 Complicated quizzes exercise page" }).click()
  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()

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
    .getByText("Correct", { exact: true })
    .first()
    .waitFor({ state: "attached" })
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 2 content"]')
    .getByText("Correct", { exact: true })
    .first()
    .waitFor({ state: "attached" })
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByText("Correct", { exact: true })
    .first()
    .waitFor({ state: "attached" })

  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()

  await page.getByRole("button", { name: "try again" }).click()
  await scrollLocatorsParentIframeToViewIfNeeded(
    page
      .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
      .getByRole("button", { name: "Correct" })
      .nth(2),
  )
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 3 content"]')
    .getByRole("button", { name: "Correct" })
    .nth(2)
    .click()

  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()

  await page.getByRole("button", { name: "Submit" }).click()
  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()
})
