import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test.only("Peer review followed by self review works", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()
  await page.getByLabel("University of Helsinki, Department of Mathematics and Statistics").click()
  await page.getByLabel("Manage course 'Self review'").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page
    .getByRole("row", { name: "The timeline /chapter-1/the-" })
    .getByRole("button")
    .first()
    .click()
  await page.getByText("Peer and self review").click()
  await page.getByText("Add peer review").click()
  await page.getByText("Add self review").click()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.getByText("Peer and self review").click()
  const page1Promise = page.waitForEvent("popup")
  await page.getByRole("link", { name: "Course default peer review" }).click()
  const page1 = await page1Promise
  await page1.getByLabel("Add default block").click()
  await page1.getByLabel("Empty block; start writing or").fill("Here's what you will do: x.")
  await page1
    .getByLabel("Peer review questionThe answer was easy to read")
    .fill("The answer was hard to read")
  await page1
    .getByLabel("Peer review questionThe answer was correct")
    .fill("The answer was incorrect")
  await page1.getByRole("button", { name: "Save" }).click()
  await page1.getByText("Operation successful!").waitFor()
  await page1.getByLabel("Peer reviews to receive *").fill("1")
  await page1.getByLabel("Peer reviews to give *").fill("2")
  await page1.getByRole("button", { name: "Save" }).click()
  await page1.getByText("Operation successful!").waitFor()
  const page2Promise = page.waitForEvent("popup")
  await page.getByRole("button", { name: "Open saved page in a new tab" }).click()
  const page2 = await page2Promise
  await selectCourseInstanceIfPrompted(page2)
  await page2.getByText("After you submit this").waitFor()
  await page2.getByRole("button", { name: "Submit" }).click()
  await page2.getByRole("button", { name: "Start peer review" }).click()
  await page2.getByText("No answers available to peer").waitFor()
  await page2.getByLabel("Open menu").click()
  await page2.getByRole("button", { name: "Log out" }).click()
  await page2.getByRole("button", { name: "Log in" }).click()
  await page2.getByLabel("Email *").fill("student1@example.com")
  await page2.getByLabel("Password *").fill("student1")
  await page2.getByRole("button", { name: "Log in" }).click()
  await selectCourseInstanceIfPrompted(page2)
  // TODO: Where's the anwering?
  await page2.getByRole("button", { name: "Submit" }).click()
  await page2.getByRole("button", { name: "Start peer review" }).click()
  await page2.getByText("1 / 2 Peer reviews given").click()
  await page2.getByRole("heading", { name: "Peer review instructions" }).waitFor()
  await page2.getByText("Here's what you will do: x.").waitFor()
  await page2.getByRole("heading", { name: "Answer submitted by another" }).waitFor()
  await page2.getByPlaceholder("Write a review").fill("Best answer of our generation!")
  await page2.getByText("Agree", { exact: true }).first().click()
  await page2
    .locator("div")
    .filter({ hasText: /^Disagree$/ })
    .nth(1)
    .click()
  await page2.getByRole("button", { name: "Submit" }).click()
  await page2.getByText("Operation successful!").waitFor()
  await page2.getByText("No answers available to peer review").waitFor()
  await page2.getByLabel("Open menu").click()
  await page2.getByRole("button", { name: "Log out" }).click()
  await page2.getByRole("button", { name: "Log in" }).click()
  await page2.getByLabel("Email *").fill("student2@example.com")
  await page2.getByLabel("Password *").fill("student2")
  await page2.getByRole("button", { name: "Log in" }).click()
  await selectCourseInstanceIfPrompted(page2)
  // TODO: where's the answering?
  await page2.getByRole("button", { name: "Submit" }).click()
  await page2
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByText("Your answer was not correct.")
    .waitFor()
  await page2.getByRole("button", { name: "Start peer review" }).click()
  await page2.getByText("Agree", { exact: true }).first().click()
  await page2
    .locator("div")
    .filter({ hasText: /^Agree$/ })
    .nth(1)
    .click()
  await page2.getByRole("button", { name: "Submit" }).click()
  await page2
    .locator("div")
    .filter({ hasText: /^Agree$/ })
    .first()
    .click()
  await page2
    .locator("div")
    .filter({ hasText: /^Agree$/ })
    .nth(1)
    .click()
  await page2.getByPlaceholder("Write a review").fill("LOL")
  await page2.getByRole("button", { name: "Submit" }).click()
  await page2.getByRole("button", { name: "Submit" }).waitFor({ state: "hidden" })
  await expect(page2.getByLabel("Exercise:Best quizzes exercise")).not.toContainText(
    "Waiting for other students to review your answer.",
  )
})
