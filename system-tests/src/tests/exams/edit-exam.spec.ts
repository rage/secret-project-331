import { expect, test } from "@playwright/test"

import { DateTimeLocalField } from "@/utils/components/DateTimeLocalField"
import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Editing exam works", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  //Create exam
  await page.getByRole("button", { name: "Create" }).nth(1).click()
  await page.getByLabel("Name", { exact: true }).fill("Test exam")
  await new DateTimeLocalField(page, "exam-starts-at-field").setValue("1990-12-03T12:00")
  await new DateTimeLocalField(page, "exam-ends-at-field").setValue("2052-03-09T09:08")
  await page.getByLabel("Time in minutes", { exact: true }).fill("60")
  await page.getByRole("button", { name: "Submit" }).click()

  await page
    .getByTestId("exam-list-item")
    .filter({ hasText: "Test exam" })
    .getByRole("link", { name: "Manage" })
    .click()

  //Edit exam
  await page.getByRole("button", { name: "Edit exam" }).click()
  await page.getByLabel("Name", { exact: true }).fill("New name")
  await page.getByLabel("Time in minutes", { exact: true }).fill("120")
  await page.getByRole("checkbox", { name: "Related courses can be" }).check()
  await page.getByLabel("Minimum points to pass", { exact: true }).fill("20")
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Exam edited successfully").waitFor()

  await expect(page.getByRole("heading", { name: "New name" })).toBeVisible()
})
