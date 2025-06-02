import { test } from "@playwright/test"

import { selectOrganization } from "../../utils/organizationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Creating an exam works", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.getByRole("button", { name: "Create" }).nth(1).click()
  await page.getByRole("heading", { name: "New Exam" }).waitFor()
  await page.getByLabel("Name", { exact: true }).fill("New exam")
  await page.getByLabel("Starts at").fill("1990-12-03T12:00")

  await page.getByLabel("Ends at").fill("2052-03-09T09:08:01")
  await page.getByLabel("Time in minutes", { exact: true }).fill("7")
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Exam created successfully").waitFor()
})
