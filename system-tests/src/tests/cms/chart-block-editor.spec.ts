import { expect, type Locator, type Page, test } from "@playwright/test"

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

// A complete chart that carries no data reference at all. Typing this over a spec that had one
// leaves the chart without data until the teacher puts the file back.
const SPEC_WITHOUT_DATA = JSON.stringify({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  mark: "bar",
  encoding: {
    x: { field: "category", type: "nominal" },
    y: { field: "value", type: "quantitative" },
  },
})

// Vega-Lite allows each layer its own data, which is what Altair writes when layers come from
// different sources. Such a spec has no top-level data even though it is fully specified.
const LAYERED_SPEC_WITH_DATA_IN_LAYERS = JSON.stringify({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  layer: [
    {
      data: { values: [{ category: "A", value: 12 }] },
      mark: "bar",
      encoding: {
        x: { field: "category", type: "nominal" },
        y: { field: "value", type: "quantitative" },
      },
    },
    {
      data: { values: [{ category: "A", value: 20 }] },
      mark: "line",
      encoding: {
        x: { field: "category", type: "nominal" },
        y: { field: "value", type: "quantitative" },
      },
    },
  ],
})

// Creates a page and inserts an empty chart block into it, which opens the block's editor on the
// first step of the guided flow.
const createPageWithChartBlock = async (page: Page, title: string) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.getByRole("link", { name: "Manage course 'Permission management'" }).click()
  await page.getByRole("tab", { name: "Pages" }).click()
  // Chapter 3: concurrent page creation in the same chapter races with other tests
  // (converting-blocks uses chapter 2, custom-iframe chapter 1).
  await page.getByRole("button", { name: "New page" }).nth(3).click()
  await page.getByLabel("Title  *").fill(title)
  await page.getByRole("button", { name: "Create" }).click()
  await page.getByRole("row", { name: title }).getByRole("button", { name: "Edit page" }).click()

  await page.getByLabel("Add block").click()
  await page.getByPlaceholder("Search").fill("chart")
  await page.getByRole("option", { name: "Chart" }).click()
}

// Uploads a data file on the first step of the guided flow.
const uploadDataFile = async (page: Page, fixture: string) => {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("dialog").locator('button:has-text("Upload")').click(),
  ])
  await chooser.setFiles(fixture)
}

// Monaco is code split and fetches its own (large) bundle, so first paint of the editor can take
// far longer than the default assertion timeout allows.
const expectVegaJsonEditorToBeVisible = (dialog: Locator) =>
  expect(dialog.locator(".monaco-editor").first()).toBeVisible({ timeout: 30_000 })

// Replaces the whole Monaco document. insertText is used instead of type() so Monaco's
// auto-closing brackets don't corrupt the JSON; content must be a single line (no newlines).
const setMonacoContent = async (page: Page, content: string) => {
  await page.locator(".monaco-editor").first().click()
  await page.keyboard.press("Control+A")
  await page.keyboard.press("Delete")
  await page.keyboard.insertText(content)
}

test("Chart block editor works", async ({ page }) => {
  // A new block starts empty and the editor opens straight to the data-first upload step — there
  // is no spec editor until a data file is added.
  await createPageWithChartBlock(page, "Chart block test page")

  const dialog = page.getByRole("dialog", { name: "Edit chart" })
  // The editor opens automatically on insert, on the upload step, with no spec editor yet.
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("Step 1 of 3")).toBeVisible()
  await expect(dialog.getByText("Start by adding a data file")).toBeVisible()
  await expect(
    dialog.getByText("Upload a CSV or JSON file containing the chart data."),
  ).toBeVisible()
  await expect(dialog.locator(".monaco-editor")).toHaveCount(0)

  // Uploading a data file moves on to choosing how the chart itself gets made.
  await uploadDataFile(page, "src/fixtures/media/chart-data.csv")
  await expect(dialog.getByText("How do you want to create the chart?")).toBeVisible({
    timeout: 30_000,
  })
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Generate with AI" })).toBeVisible()
  // The manual option points at Vega-Altair as the friendlier way to author a specification.
  await expect(dialog.getByRole("link", { name: "Vega-Altair documentation" })).toHaveAttribute(
    "href",
    "https://altair-viz.github.io/",
  )

  // Stepping back shows the file that was uploaded, and Continue returns to the method step —
  // the data step must not become a dead end once a file is attached.
  await dialog.getByRole("button", { name: "Back" }).click()
  await expect(dialog.getByText("Step 1 of 3")).toBeVisible()
  // The file is stored under a generated name, so only its extension is predictable.
  await expect(dialog.getByText(/\.csv/)).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()
  await dialog.getByRole("button", { name: "Continue" }).click()
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible()

  // The manual route opens the full editor with the Vega JSON already revealed.
  await dialog.getByRole("button", { name: "Write the Vega JSON myself" }).click()
  await expectVegaJsonEditorToBeVisible(dialog)
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()
  // In the editor the AI is offered as a way to redo an existing chart.
  await expect(dialog.getByRole("button", { name: "Re-generate with AI" })).toBeVisible()

  // Invalid JSON is flagged and the preview shows an error rather than crashing. The uploaded data
  // file is remembered even while the spec is broken.
  await setMonacoContent(page, "this is not valid json")
  // By role, because the preview's error heading says the same words once the render check has run.
  await expect(dialog.getByRole("status")).toHaveText("Invalid JSON")
  await expect(
    dialog.getByText("The chart could not be displayed because its specification is invalid."),
  ).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()

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
  expect(dataFileHref).not.toBeNull()
  const dataFileResponse = await page.request.get(new URL(String(dataFileHref), page.url()).href)
  expect(dataFileResponse.ok()).toBeTruthy()
  expect(await dataFileResponse.json()).toStrictEqual([
    { category: "A", value: 12 },
    { category: "B", value: 34 },
    { category: "C", value: 56 },
  ])
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()

  // Removing the data file strips it from the spec and brings back the uploader.
  await dialog.getByRole("button", { name: "Remove" }).click()
  await expect(dialog.getByText("This chart is missing its data file.")).toBeVisible()
  await expect(
    dialog.getByText("Upload a CSV or JSON file containing the chart data."),
  ).toBeVisible()

  // A JSON data file can be uploaded the same way.
  await uploadDataFile(page, "src/fixtures/media/chart-data.json")
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible({ timeout: 30_000 })

  // The caption can be filled in. getByRole because the TextField's label element carries an
  // aria-label of its own, which makes getByLabel ambiguous.
  const captionInput = dialog.getByRole("textbox", { name: "Caption" })
  await captionInput.fill("Quarterly results")
  await expect(captionInput).toHaveValue("Quarterly results")

  // Close via the modal's header close button.
  await dialog.getByRole("button", { name: "Close" }).click()
  await expect(page.getByRole("dialog", { name: "Edit chart" })).toBeHidden()

  // The page with the chart block saves without errors.
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click()
  })

  // The block round-trips through save and parse: after a reload it is still recognized as a
  // valid chart block and its attributes survived.
  await page.reload()
  await page.getByLabel("Block: Chart").click()
  await page.getByRole("button", { name: "Edit chart" }).first().click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("textbox", { name: "Caption" })).toHaveValue("Quarterly results")
  // The spec still points at the uploaded data file.
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()
})

// Opens a new block's editor with a data file attached and the Vega JSON revealed.
const openEditorWithDataFile = async (page: Page, title: string) => {
  await createPageWithChartBlock(page, title)
  const dialog = page.getByRole("dialog", { name: "Edit chart" })
  await expect(dialog.getByText("Step 1 of 3")).toBeVisible()
  await uploadDataFile(page, "src/fixtures/media/chart-data.csv")
  await expect(dialog.getByText("How do you want to create the chart?")).toBeVisible({
    timeout: 30_000,
  })
  await dialog.getByRole("button", { name: "Write the Vega JSON myself" }).click()
  await expectVegaJsonEditorToBeVisible(dialog)
  return dialog
}

test("Chart block offers the data file back to a spec that dropped it", async ({ page }) => {
  const dialog = await openEditorWithDataFile(page, "Chart block re-insert test page")

  // Nothing rewrites the spec behind the teacher's back; the file is offered back once typing
  // settles.
  await setMonacoContent(page, SPEC_WITHOUT_DATA)
  await expect(dialog.getByText("This chart is missing its data file.")).toBeVisible({
    timeout: 30_000,
  })
  const reinsertButton = dialog.getByRole("button", {
    name: "Add the file back to the specification",
  })
  await expect(reinsertButton).toBeVisible()
  await expect(
    dialog.getByText("The chart specification no longer refers to this file"),
  ).toBeVisible()

  // Putting it back points the spec at the file again, and the chart renders from it.
  await reinsertButton.click()
  await expect(dialog.locator(".monaco-editor").first()).toContainText(".csv")
  await expect(dialog.getByText("This chart is missing its data file.")).toBeHidden()
  await expect(reinsertButton).toBeHidden()
  await expect(dialog.locator("svg.marks")).toBeVisible()
  // The pressed button unmounts, so focus goes to its sibling rather than the dialog body.
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeFocused()
  await expect(dialog.getByText("The data file is back in the chart specification.")).toBeVisible()
})

test("Chart block remembers its data file across a save and reopen", async ({ page }) => {
  const dialog = await openEditorWithDataFile(page, "Chart block file memory test page")

  // Only the block's attribute remembers the file here; the spec text no longer names it.
  await setMonacoContent(page, SPEC_WITHOUT_DATA)
  await expect(dialog.getByText("This chart is missing its data file.")).toBeVisible({
    timeout: 30_000,
  })
  await dialog.getByRole("button", { name: "Close" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click()
  })

  await page.reload()
  await page.getByLabel("Block: Chart").click()
  await page.getByRole("button", { name: "Edit chart" }).first().click()
  await expect(dialog).toBeVisible()

  // The file survived the round trip, so it can still be put back into the spec.
  await expect(dialog.getByText(/\.csv/)).toBeVisible()
  const reinsertButton = dialog.getByRole("button", {
    name: "Add the file back to the specification",
  })
  await expect(reinsertButton).toBeVisible({ timeout: 30_000 })
  await reinsertButton.click()
  await expect(dialog.getByText("This chart is missing its data file.")).toBeHidden()
  await expect(dialog.locator("svg.marks")).toBeVisible()
})

// Long enough that the stored file is reported only after the editor has been opened.
const LATE_UPLOAD_DELAY_MS = 5000

test("Chart block keeps the editor open when the data file finishes uploading late", async ({
  page,
}) => {
  // The media library reports an attachment twice: first a local blob URL, then the stored file.
  // Holding the response back puts that second report after the teacher has moved on.
  await page.route("**/api/v0/cms/courses/*/upload", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, LATE_UPLOAD_DELAY_MS)
    })
    await route.continue()
  })

  const dialog = await openEditorWithDataFile(page, "Chart block late upload test page")

  // The spec names the stored file only once that second report has been handled, so reading the
  // name out of the editor proves the editor outlived it instead of being sent back a step.
  await expect(dialog.locator(".monaco-editor").first()).toContainText(".csv", { timeout: 30_000 })
  await expect(dialog.getByText("How do you want to create the chart?")).toBeHidden()
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()
})

test("Chart block renders a spec whose data lives in its layers", async ({ page }) => {
  const dialog = await openEditorWithDataFile(page, "Chart block layered spec test page")

  // Data on the individual layers counts as data: the chart renders instead of reporting a
  // missing file, and the attached file is not offered back on top of it.
  await setMonacoContent(page, LAYERED_SPEC_WITH_DATA_IN_LAYERS)
  // Vega gives its rendered chart's root SVG the "marks" class.
  await expect(dialog.locator("svg.marks")).toBeVisible()
  await expect(dialog.getByText("This chart is missing its data file.")).toBeHidden()
  await expect(
    dialog.getByRole("button", { name: "Add the file back to the specification" }),
  ).toBeHidden()
})

test("Chart block can be generated with AI", async ({ page }) => {
  await createPageWithChartBlock(page, "Chart block AI test page")

  const dialog = page.getByRole("dialog", { name: "Edit chart" })
  await expect(dialog.getByText("Step 1 of 3")).toBeVisible()

  await uploadDataFile(page, "src/fixtures/media/chart-data.csv")
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible({ timeout: 30_000 })

  // The AI route asks what the chart should show before generating anything. The dialog is renamed
  // for this step, so it no longer matches the "Edit chart" locator.
  await dialog.getByRole("button", { name: "Generate with AI" }).click()
  const aiDialog = page.getByRole("dialog", { name: "Generate with AI" })
  await expect(aiDialog.getByText("Step 3 of 3")).toBeVisible()
  await aiDialog
    .getByRole("textbox", { name: "What kind of chart do you want?" })
    .fill("A bar chart of the value in each category")
  await aiDialog.getByRole("button", { name: "Generate" }).click()

  // The generated chart lands in the editor with the Vega JSON collapsed: what the teacher should
  // be judging is the preview, not the specification.
  await expect(dialog.getByRole("button", { name: "Re-generate with AI" })).toBeVisible({
    timeout: 60_000,
  })
  await expect(dialog.locator(".monaco-editor")).toHaveCount(0)
  // The spec returned by the (mock) model describes itself, which syncs into the caption.
  await expect(dialog.getByRole("textbox", { name: "Caption" })).toHaveValue(
    "Mock AI generated bar chart",
  )
  // The teacher's own data file is what the chart reads: the model never supplies data, and the
  // generation step binds the uploaded file to whatever specification came back.
  await expect(dialog.getByText(/\.csv/)).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible()

  // The generated specification is there to inspect and edit once revealed.
  await dialog.getByRole("button", { name: "View Vega JSON" }).click()
  await expectVegaJsonEditorToBeVisible(dialog)
  await expect(dialog.getByText("Invalid JSON")).toHaveCount(0)

  await dialog.getByRole("button", { name: "Close" }).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click()
  })
})
