import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Limited tries work", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage\\ course\\ \\'Limited\\ tries\\'\"] svg").click()

  await page.locator('a[role="tab"]:has-text("Pages")').click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/9da60c66-9517-46e4-b351-07d0f7aa6cd4/pages",
  )

  await page
    .getByRole("row", { name: "Page 6 /chapter-1/page-6 Edit" })
    .getByRole("button")
    .first()
    .click()

  await page.locator('[placeholder="Max\\ points"]').click()
  // Fill [placeholder="Max\ points"]
  await page.locator('[placeholder="Max\\ points"]').fill("8")

  await page.getByText("Limit number of tries").click()

  await page.locator('[placeholder="Max\\ tries\\ per\\ slide"]').click()
  // Fill [placeholder="Max\ tries\ per\ slide"]
  await page.locator('[placeholder="Max\\ tries\\ per\\ slide"]').fill("2")

  await page.locator(`button:text-is("Save")`).nth(1).click()

  await page.getByText("Operation successful!").waitFor()

  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.getByText("Limited tries").click()

  await page.getByText("Objective #1").waitFor({ state: "attached" })

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("Start course").click()

  await page.getByText("The Basics").click()

  await page.getByText("6Page 6").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/limited-tries/chapter-1/page-6",
  )

  await Promise.all([
    page.locator('span.heading:has-text("POINTS")').waitFor(),
    page.locator('div.points:has-text("0/8")').waitFor(),
  ])

  await page.locator('div.tries:has-text("2")').waitFor()

  await page.frameLocator("iframe").getByText("AC").click()

  await page.frameLocator("iframe").getByText("Jupiter").click()

  await page.getByText("Submit").click()

  await page.locator('div.tries:has-text("1")').waitFor()

  await page.getByText("try again").click()

  await page.frameLocator("iframe").getByText("AC").click()
  await page.frameLocator("iframe").getByText("Jupiter").click()

  await page.frameLocator("iframe").getByText("Erlang").click()

  await page.frameLocator("iframe").getByText("Jupiter").click()

  await page.getByText("Submit").click()

  await page.locator('div.tries:has-text("0")').waitFor()
  await page.getByText("try again").waitFor({ state: "hidden" })
})
