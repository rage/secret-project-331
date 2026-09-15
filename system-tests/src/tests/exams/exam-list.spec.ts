import { test } from "@playwright/test"

import { DateTimeLocalField } from "@/utils/components/DateTimeLocalField"
import { selectOrganization } from "@/utils/organizationUtils"

import expectUrlPathWithRandomUuid from "../../utils/expect"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("exam list renders, can create exam", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.getByText("Exams").nth(1).click()

  await page.getByText("Introduction to Everything").first().waitFor()
  await page.getByRole("link", { name: "Automatic course exam" }).last().waitFor()
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  await page.getByRole("button", { name: "Create" }).nth(1).click()
  await page.getByLabel("Name", { exact: true }).fill("new exam")
  await new DateTimeLocalField(page, "exam-starts-at-field").setValue("2099-11-11T13:15")
  await new DateTimeLocalField(page, "exam-ends-at-field").setValue("2099-11-12T13:15")
  await page.getByLabel("Time in minutes", { exact: true }).fill("120")

  await page.getByText("Submit").click()
  await page.getByText("Success").first().waitFor()
})
