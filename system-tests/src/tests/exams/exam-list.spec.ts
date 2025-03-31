import { test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "@/utils/expect"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("exam list renders, can create exam", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.click(
      '[aria-label="University of Helsinki, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  await page.getByText("Exams").nth(1).click()

  await page.getByText("Introduction to Everything").first().waitFor()
  await page.getByRole("link", { name: "Automatic course exam" }).last().waitFor()
  await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

  await page.getByRole("button", { name: "Create" }).nth(1).click()
  await page.locator('[label="Name"]').fill("new exam")
  await page.locator('[label="Starts\\ at"]').fill("2099-11-11T13:15")
  await page.locator('[label="Ends\\ at"]').fill("2099-11-12T13:15")
  await page.locator('[label="Time\\ in\\ minutes"]').fill("120")

  await page.getByText("Submit").click()
  await page.getByText("Success").first().waitFor()
})
