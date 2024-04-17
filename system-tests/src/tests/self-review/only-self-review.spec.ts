import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("An exercise that has self review but no peer review works", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()
  await page.getByLabel("University of Helsinki, Department of Mathematics and Statistics").click()
  await page.getByLabel("Manage course 'Self review'").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page
    .getByRole("row", { name: "Multiple choice with feedback" })
    .getByRole("button")
    .first()
    .click()
  await page.getByText("Peer and self review").click()
  await page.getByText("Add self review").click()
  await page.getByText("Use course default peer").click()
  await page.getByLabel("Add default block").click()
  await page.getByLabel("Empty block; start writing or").fill("In this review, you have to do x.")
  await page.getByRole("button", { name: "Add peer review question" }).click()
  await page.getByRole("button", { name: "Add peer review question" }).click()
  await page.getByLabel("Peer review questionInsert").click()
  await page.getByLabel("Peer review questionInsert").fill("General feedback")
  await page.getByRole("button", { name: "Add peer review question" }).click()
  await page.getByLabel("Peer review question type").nth(1).selectOption("Scale")
  await page.getByLabel("Peer review questionInsert").click({
    clickCount: 3,
  })
  await page.getByLabel("Peer review questionInsert").fill("The answer was correct")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByText("Operation successful!").waitFor()
  const page1Promise = page.waitForEvent("popup")
  await page.getByRole("button", { name: "Open saved page in a new tab" }).click()
  const page1 = await page1Promise
  await selectCourseInstanceIfPrompted(page1)
  await page1
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("button", { name: "cargo" })
    .click()
  await page1.getByRole("button", { name: "Submit" }).click()
  await page1
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByText("Your answer was correct.")
    .waitFor()
  await page1.getByRole("button", { name: "Start self review" }).click()
  await page1.getByText("In this review, you have to do x.").waitFor()
  await page1.getByPlaceholder("Write a review").fill("This was such a good answer 100/100.")
  await page1
    .locator("div")
    .filter({ hasText: /^Agree$/ })
    .locator("ellipse")
    .first()
    .click()
  await page1.getByRole("button", { name: "Submit" }).click()
  await page1.getByText("Operation successful!").waitFor()
  await page1.getByText("Waiting for course staff to").waitFor()
  await page.goto(
    "http://project-331.local/manage/courses/3cbaac48-59c4-4e31-9d7e-1f51c017390d/pages",
  )
  await page.getByRole("tab", { name: "Exercises" }).click()
  await page.getByRole("link", { name: "View answers requiring" }).click()
  await page.getByRole("button", { name: "Custom points" }).click()
  await page.getByRole("slider").fill("0.7")
  await page.getByRole("button", { name: "Give custom points" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page1.reload()
  await page1.getByText("0.7").waitFor()
  await page1.getByText("Your answer has been reviewed").waitFor()
})
