import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Changing view in the cms sidebar works", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    ),
  ])

  await page
    .locator("[aria-label=\"Manage\\ course\\ \\'Introduction\\ to\\ Statistics\\'\"] svg")
    .click()

  await page.getByText("Pages").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/f307d05f-be34-4148-bb0c-21d6f7a35cdb/pages",
  )

  await page.getByText("Edit page").click()

  await page.getByText("Welcome to...").click()

  await expect(page.getByRole("heading", { name: "Landing Page Hero Section" })).toBeVisible()

  // Select block-list
  await page.locator("select").selectOption("block-list")

  await expect(page.getByText("Course Objective Section").first()).toBeVisible()

  // Select block-menu
  await page.locator("select").selectOption("block-menu")

  await expect(page.getByRole("option", { name: "List", exact: true })).toBeVisible()
})
