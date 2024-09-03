import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Code giveaways work", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByLabel("Manage course 'Giveaway'").click()
  await page.getByRole("tab", { name: "Other" }).click()
  await page.getByRole("tab", { name: "Code giveaways" }).click()
  await page.getByRole("button", { name: "New" }).click()
  await page.getByLabel("Name", { exact: true }).fill("Best code giveaway of this generation")
  await page.getByRole("button", { name: "Create" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.getByRole("link", { name: "Best code giveaway of this" }).click()
  await page.getByRole("button", { name: "Import" }).click()
  await page
    .getByLabel("Codes, one per linecode 1")
    .fill("\n\n\ncode 1\n  code 2\n\n  code 3  \n\n\n")
  await page.getByRole("button", { name: "Import" }).click()
  await page.getByText("******").first().waitFor()
  await page.getByRole("button", { name: "Reveal" }).click()
  await page.getByText("code 1").waitFor()
  await page.getByRole("button", { name: "Hide" }).click()
  await page.getByText("******").first().waitFor()
  await page.goBack()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page
    .getByRole("row", { name: "Giveaway / Edit page Dropdown" })
    .getByRole("button")
    .first()
    .click()
  await page.getByLabel("Add block").click()
  await page.getByPlaceholder("Search").fill("code")
  await page.getByRole("option", { name: "CodeGiveaway" }).click()
  await page.getByRole("heading", { name: "CodeGiveaway" }).click()
  await page
    .locator("div")
    .filter({ hasText: /^Select an optionBest code giveaway of this generation$/ })
    .getByRole("combobox")
    .selectOption({ label: "Best code giveaway of this generation" })
  await page.getByLabel("Add default block").click()
  await page
    .getByLabel("Empty block; start writing or")
    .fill("Congratulations! You're the 1 billionth visitor to this website!")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByText("Operation successful!").waitFor()
  const page1Promise = page.waitForEvent("popup")
  await page.getByRole("button", { name: "Open saved page in a new tab" }).click()

  const page1 = await page1Promise
  await selectCourseInstanceIfPrompted(page1)
})
