import { test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test.only("partner block tests", async ({ page }) => {
  test.slow()
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Mathematics and Statistics").click(),
  ])

  await page.getByLabel("Manage course 'Introduction to citations").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page.getByText("Create Partners Section").click()

  await page.locator("button.components-button").click()

  await page.click('text="Image"')

  // Upload file with fileChooser
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click('button:has-text("Upload")'),
  ])
  await fileChooser.setFiles("src/fixtures/media/welcome_exercise_decorations.png")
  await page.getByRole("button", { name: "Save", exact: true }).click()

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-citations")

  await page.locator("div.partners-block").click()
  await page.locator('[data-test-id="partners-block"]').waitFor()

  await page.getByText("Reference").scrollIntoViewIfNeeded()
})
