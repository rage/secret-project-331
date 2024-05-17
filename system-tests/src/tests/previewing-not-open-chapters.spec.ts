import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Teachers can preview chapters that are not open yet", async ({ page, browser }) => {
  // Teachers can preview chapters that are not open yet
  await page.goto("http://project-331.local/organizations")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Mathematics and Statistics" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Preview unopened chapters'" }).click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page
    .getByRole("heading", { name: "Chapter 1: The Basics Dropdown menu" })
    .getByRole("button", { name: "Dropdown menu" })
    .click()
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByPlaceholder("Opens at").fill("3200-04-17T19:13:24")
  await page.getByRole("button", { name: "Update" }).click()
  await page.getByText("Operation successful").waitFor()
  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1 Edit page Dropdown menu" })
    .getByRole("button", { name: "Edit page" })
    .click()
  const page1Promise = page.waitForEvent("popup")
  await page.getByRole("button", { name: "Open saved page in a new tab" }).click()
  const page1 = await page1Promise
  await selectCourseInstanceIfPrompted(page1)
  await page1.getByText("Everything is a big topic.").click()
  await page1
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await page1.getByRole("button", { name: "Submit" }).click()
  await page1.getByText("Good job!").click()
  // A normal user cannot preview chapters that are not open yet
  const context2 = await browser.newContext({ storageState: "src/states/user@example.com.json" })
  const page3 = await context2.newPage()
  await page3.goto(
    "http://project-331.local/org/uh-mathstat/courses/preview-unopened-chapters/chapter-1/page-1",
  )
  await page3.getByText("Chapter is not open yet.", { exact: true }).waitFor()
  await context2.close()
})

test("Material viewers can preview chapters that are not open yet by directly visiting an url", async ({
  browser,
}) => {
  // Users with the material viewer role **intentionally** can view chapters that are not open yet by visiting the page url directly.
  // This role is used by teachers to let students test unopened chapters.
  const context = await browser.newContext({
    storageState: "src/states/material.viewer@example.com.json",
  })
  const page = await context.newPage()
  await page.goto(
    "http://project-331.local/org/uh-mathstat/courses/preview-unopened-chapters/chapter-1/page-1",
  )
  await selectCourseInstanceIfPrompted(page)
  await page.getByText("Everything is a big topic.").click()
  await page
    .frameLocator('iframe[title="Exercise 1\\, task 1 content"]')
    .getByRole("checkbox", { name: "b" })
    .click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Good job!").click()
  await context.close()
})
