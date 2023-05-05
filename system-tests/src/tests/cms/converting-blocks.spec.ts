import { test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Can convert blocks", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Permission management'" }).click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page
    .locator(".css-1oaaogx > .css-noo2yn > .css-nyz7p3 > .css-1fytp2i-PrimaryButton")
    .first()
    .click()
  await page.getByLabel("Title  *").fill("Test page")
  await page.getByRole("button", { name: "Create" }).click()
  await page
    .getByRole("row", { name: "Test page /chapter-2/test-page Edit page Dropdown menu" })
    .getByRole("button", { name: "Edit page" })
    .click()
  await page.getByRole("button", { name: "Add block" }).click()
  await page.getByRole("option", { name: "Paragraph" }).click()
  await page
    .getByRole("document", {
      name: "Empty block; start writing or type forward slash to choose a block",
    })
    .fill("Test paragraph 1")
  await page.getByRole("document", { name: "Paragraph block" }).press("Enter")
  await page
    .getByRole("document", {
      name: "Empty block; start writing or type forward slash to choose a block",
    })
    .fill("Test paragraph 2")
  await page.getByRole("textbox", { name: "Hero section title..." }).click()
  await page.getByText("Test paragraph 1").click()
  await page.getByRole("button", { name: "Paragraph" }).click()
  await page.getByRole("menuitem", { name: "Heading" }).click()
  await page.getByRole("button", { name: "Change heading level" }).click()
  await page.getByRole("menuitemradio", { name: "Heading 3" }).click()
  // There once was a regression where the page crashed here if we waited for a moment
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(200)
  await page.getByRole("document", { name: "Paragraph block" }).waitFor()
})
