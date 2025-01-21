import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("material reference tests", async ({ page, headless }, testInfo) => {
  test.slow()
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Mathematics and Statistics").click(),
  ])

  await page.locator("[aria-label=\"Manage course \\'Introduction to citations\\'\"] svg").click()
  await page.getByRole("tab", { name: "Other" }).click()
  await page.getByRole("tab", { name: "References" }).click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "material-reference-list",
    waitForTheseToBeVisibleAndStable: [page.getByText("Add new reference")],
  })

  await page.getByText("Add new reference").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["page-has-heading-one"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "add-new-material-reference-dialog",
    waitForTheseToBeVisibleAndStable: [page.getByText("Submit"), page.locator("text=Close")],
  })

  await page.locator('textarea[name="references"]').click()

  // Fill textarea[name="references"]
  await page.locator('textarea[name="references"]').fill(
    `
@incollection{wang2003artificial,
  title={Artificial neural network},
  author={Wang, Sun-Chong},
  booktitle={Interdisciplinary computing in java programming},
  pages={81--100},
  year={2003},
  publisher={Springer}
}
      `,
  )

  await page.getByText("Submit").click()

  await page.getByText("Success").first().waitFor()

  // If the bibtext fails to parse, an error will be displayed.
  await page.getByText("Error").first().waitFor({ state: "hidden" })

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["heading-order"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "new-material-reference-added",
    waitForTheseToBeVisibleAndStable: [page.getByText("Add new reference")],
    clearNotifications: true,
  })

  await page.getByText("Edit reference").click()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["heading-order", "page-has-heading-one"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "material-reference-editor",
    waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Edit reference" })],
  })

  // Fill textarea[name="references"]
  await page
    .locator('textarea[name="reference"]')
    .fill(
      "@incollection{wang2003,\n  title={Artificial neural network},\n  author={Wang, Sun-Chong},\n  booktitle={Interdisciplinary computing in java programming},\n  pages={81--100},\n  year={2003},\n  publisher={Springer}\n}\n",
    )

  await page.getByText("Save").click()

  await page.getByText("Success").first().waitFor()

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["heading-order"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "material-reference-edited",
    waitForTheseToBeVisibleAndStable: [page.getByText("Add new reference")],
    clearNotifications: true,
  })

  await page.getByText("Pages").click()

  await page
    .getByRole("row", { name: "Page One /chapter-1/page-1" })
    .getByRole("button")
    .first()
    .click()

  await page.locator('[aria-label="Add block"]').click()

  await page.locator('button[role="option"]:has-text("Paragraph")').click()

  const PARAGRAPH = `This paragraph contains a citation\\cite{wang2003}.`

  await page.fill(
    '[aria-label="Empty block\\; start writing or type forward slash to choose a block"]',
    PARAGRAPH,
  )

  await expectScreenshotsToMatchSnapshots({
    axeSkip: ["region", "aria-allowed-attr"],
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "citation-in-editor",
    beforeScreenshot: async () => await page.locator(`text=${PARAGRAPH}`).scrollIntoViewIfNeeded(),
  })

  // Create table with citations
  await page.keyboard.press("Enter")
  await page.fill(
    '[aria-label="Empty block\\; start writing or type forward slash to choose a block"]',
    "/table",
  )
  await page.keyboard.press("Enter")

  const TABLE_CONTENT = ["This cell contains citation\\cite{wang2003}", "Blank", "Blank", "Blank"]
  const CAPTION_CONTENT = "This caption has citation\\cite{wang2003}"

  await page.getByText("Create Table").click()

  await page.locator('[aria-label="Body cell text"]').first().fill(TABLE_CONTENT[0])

  await page.locator('[aria-label="Body cell text"]').nth(1).fill(TABLE_CONTENT[1])

  await page.locator('[aria-label="Body cell text"]').nth(2).fill(TABLE_CONTENT[2])

  await page.locator('[aria-label="Body cell text"]').nth(3).fill(TABLE_CONTENT[3])

  await page.getByLabel("Add caption").click()

  await page.locator('[aria-label="Table caption text"]').fill(CAPTION_CONTENT)

  await page.getByText("Save").nth(3).click()
  await page.getByText(`Operation successful!`).waitFor()

  await page.goto(
    "http://project-331.local/org/uh-mathstat/courses/introduction-to-citations/chapter-1/page-1",
  )

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "citation-paragraph",
    beforeScreenshot: async () =>
      await page.locator(`text=This paragraph contains a citation`).scrollIntoViewIfNeeded(),
  })

  await page.getByText("Reference").scrollIntoViewIfNeeded()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "closed-course-material-reference-list",
    waitForTheseToBeVisibleAndStable: [page.getByText("Reference")],
    beforeScreenshot: async () => await page.getByText("Reference").scrollIntoViewIfNeeded(),
  })

  await page.getByText("Reference").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "open-course-material-reference-list",
    waitForTheseToBeVisibleAndStable: [page.getByText("Reference"), page.locator("text=Wang")],
    beforeScreenshot: async () => await page.getByText("Reference").scrollIntoViewIfNeeded(),
  })
})
