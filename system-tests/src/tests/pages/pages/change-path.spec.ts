import { test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Chaning page path works and redirects correctly", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
  await page.getByLabel("University of Helsinki, Department of Mathematics and Statistics").click()
  await page.getByLabel("Manage course 'Change Path'").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page.getByText("New page").nth(1).click()
  await page.getByLabel("Title  *").fill("page with wrong path")
  await page.getByRole("button", { name: "Create" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.getByRole("cell", { name: "/chapter-1/page-with-wrong-path" }).waitFor()
  await page
    .getByRole("row", {
      name: "page with wrong path /chapter-1/page-with-wrong-path Edit page Dropdown menu",
    })
    .getByLabel("Dropdown menu")
    .click()
  await page.getByRole("button", { name: "Edit page details" }).click()
  await page.getByLabel("Title  *").fill("page-with-right-path")
  await page.getByLabel("Path  *").fill("page-with-right-path-yeah")
  await page.getByRole("button", { name: "Update" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.getByRole("cell", { name: "/chapter-1/page-with-right-path-yeah" }).waitFor()
  // go to the old url to see if the redirect works
  await page.goto(
    `http://project-331.local/org/uh-mathstat/courses/change-path/chapter-1/page-with-wrong-path`,
  )
  await page.waitForURL(
    `http://project-331.local/org/uh-mathstat/courses/change-path/chapter-1/page-with-right-path-yeah`,
  )
})
