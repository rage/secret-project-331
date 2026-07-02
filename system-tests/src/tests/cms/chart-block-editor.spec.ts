import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

// A spec whose data is hardcoded inline; the editor should lift this into a separate uploaded file.
// Kept on a single line: keyboard.insertText only reliably inserts newline-free text into Monaco.
const SPEC_WITH_INLINE_DATA = JSON.stringify({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  mark: "bar",
  data: {
    values: [
      { category: "A", value: 12 },
      { category: "B", value: 34 },
      { category: "C", value: 56 },
    ],
  },
  encoding: {
    x: { field: "category", type: "nominal" },
    y: { field: "value", type: "quantitative" },
  },
})

// Replaces the whole Monaco document. insertText is used instead of type() so Monaco's
// auto-closing brackets don't corrupt the JSON; content must be a single line (no newlines).
const setMonacoContent = async (page: import("@playwright/test").Page, content: string) => {
  await page.locator(".monaco-editor").first().click()
  await page.keyboard.press("Control+A")
  await page.keyboard.press("Delete")
  await page.keyboard.insertText(content)
}

test("Chart block editor works", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.getByRole("link", { name: "Manage course 'Permission management'" }).click()
  await page.getByRole("tab", { name: "Pages" }).click()
  // Chapter 3: concurrent page creation in the same chapter races with other tests
  // (converting-blocks uses chapter 2, custom-iframe chapter 1).
  await page.getByRole("button", { name: "New page" }).nth(3).click()
  await page.getByLabel("Title  *").fill("Chart block test page")
  await page.getByRole("button", { name: "Create" }).click()
  await page
    .getByRole("row", { name: "Chart block test page" })
    .getByRole("button", { name: "Edit page" })
    .click()

  // Add the chart block. Its default spec renders immediately in the editor.
  await page.getByLabel("Add block").click()
  await page.getByPlaceholder("Search").fill("chart")
  await page.getByRole("option", { name: "ChartBlock" }).click()

  // Open the editing modal from the block toolbar. Assertions are scoped to the dialog because
  // the block behind it renders the same preview messages.
  await page.getByRole("button", { name: "Edit chart" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Edit chart" })
  await expect(dialog).toBeVisible()

  // Invalid JSON is flagged and the preview shows an error rather than crashing.
  await setMonacoContent(page, "this is not valid json")
  await expect(dialog.getByText("Invalid JSON")).toBeVisible()
  await expect(
    dialog.getByText("The chart could not be displayed because its specification is invalid."),
  ).toBeVisible()

  // Hardcoded inline data is lifted into a separate file that gets uploaded, and the spec is
  // rewritten to reference it by URL.
  await setMonacoContent(page, SPEC_WITH_INLINE_DATA)
  await expect(
    dialog.getByText("Data found in the chart specification was saved as a separate file"),
  ).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByRole("link", { name: "View the data file" })).toBeVisible()
  // The uploaded file contains the data that was lifted out of the spec.
  const dataFileHref = await dialog
    .getByRole("link", { name: "View the data file" })
    .getAttribute("href")
  const dataFileResponse = await page.request.get(new URL(dataFileHref ?? "", page.url()).href)
  expect(dataFileResponse.ok()).toBeTruthy()
  expect(await dataFileResponse.json()).toStrictEqual([
    { category: "A", value: 12 },
    { category: "B", value: 34 },
    { category: "C", value: 56 },
  ])
  // The data file is now set, so the remove control is shown instead of the uploader.
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()

  // Removing the data file strips it from the spec and brings back the uploader.
  await dialog.getByRole("button", { name: "Remove" }).click()
  await expect(dialog.getByText("This chart is missing its data file.")).toBeVisible()
  await expect(
    dialog.getByText("Upload a CSV or JSON file containing the chart data."),
  ).toBeVisible()

  // Uploading a CSV data file points the spec at the uploaded file.
  const [csvChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    dialog.locator('button:has-text("Upload")').click(),
  ])
  await csvChooser.setFiles("src/fixtures/media/chart-data.csv")
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible({ timeout: 30_000 })

  // A JSON data file can be uploaded the same way.
  await dialog.getByRole("button", { name: "Remove" }).click()
  await expect(
    dialog.getByText("Upload a CSV or JSON file containing the chart data."),
  ).toBeVisible()
  const [jsonChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    dialog.locator('button:has-text("Upload")').click(),
  ])
  await jsonChooser.setFiles("src/fixtures/media/chart-data.json")
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible({ timeout: 30_000 })

  // The optional caption can be filled in. getByRole because the TextField's label element
  // carries an aria-label of its own, which makes getByLabel ambiguous.
  const captionInput = dialog.getByRole("textbox", { name: "Caption (optional)" })
  await captionInput.fill("Quarterly results")
  await expect(captionInput).toHaveValue("Quarterly results")

  // Both the header icon button and the footer button are named "Close"; use the footer one.
  await dialog.getByRole("button", { name: "Close" }).last().click()
  await expect(page.getByRole("dialog", { name: "Edit chart" })).toBeHidden()

  // The page with the chart block saves without errors.
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click()
  })

  // The block round-trips through save and parse: after a reload it is still recognized as a
  // valid chart block and its attributes survived.
  await page.reload()
  await page.getByLabel("Block: ChartBlock").click()
  await page.getByRole("button", { name: "Edit chart" }).first().click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("textbox", { name: "Caption (optional)" })).toHaveValue(
    "Quarterly results",
  )
  // The spec still points at the uploaded data file.
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()
})
