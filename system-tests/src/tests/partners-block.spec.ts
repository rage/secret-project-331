import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("partner block tests", async ({ page }) => {
  test.slow()
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Mathematics and Statistics").click(),
  ])

  await page.getByLabel("Manage course 'Introduction to citations").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page.getByText("Add Partners Section").click()

  await page.locator("button.components-button").click()

  await page.click('text="Image"')

  // Upload file with fileChooser
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click('button:has-text("Upload")'),
  ])
  await fileChooser.setFiles("src/fixtures/media/sample-logo.svg")
  await page.getByRole("button", { name: "Save", exact: true }).click()

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-citations")

  await page.click('text="Default"')
  await page.click('text="Continue"')

  // Scroll and verify partners block
  const partnersBlock = page.locator('[data-test-id="partners-block"]')
  await partnersBlock.scrollIntoViewIfNeeded()
  await expect(partnersBlock).toBeVisible()
})
