import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
import { waitForFooterTranslationsToLoad } from "../../utils/waitingUtils"

import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test.describe(() => {
  // Sometimes the location of the Gutenberg toolbar is nondeterministic
  test.describe.configure({ retries: 4 })

  test("Spacers should not break text editing under them, block inserter should not go on top of the typing caret", async ({
    page,
    headless,
  }, testInfo) => {
    await page.goto("http://project-331.local/organizations")
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")
    await page.getByRole("link", { name: "Manage course 'Glossary Tooltip'" }).click()
    await page.getByRole("tab", { name: "Pages" }).click()
    await page
      .getByRole("row", { name: "Glossary /chapter-1 Edit page Dropdown menu" })
      .getByRole("button", { name: "Edit page" })
      .click()

    await page.getByRole("button", { name: "Add block" }).waitFor()
    await waitForFooterTranslationsToLoad(page)

    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Add block" }).click()
    await page.getByRole("option", { name: "Paragraph" }).click()
    await page
      .getByRole("document", {
        name: "Empty block; start writing or type forward slash to choose a block",
      })
      .waitFor()
    await page
      .getByRole("document", {
        name: "Empty block; start writing or type forward slash to choose a block",
      })
      .fill("This text should remain editable")
    await page.getByText("This text should remain editable").press("Control+A")
    // In this screenshot the plus sign for inserting a new block should not be on top of the typing caret.
    await expectScreenshotsToMatchSnapshots({
      headless,
      testInfo,
      screenshotTarget: page,
      snapshotName: "new-block-inserter-should-not-obscure-typing-caret",
      axeSkip: ["aria-allowed-attr", "aria-allowed-role", "region", "heading-order"],
    })
    await page
      .getByText("Pages in chapter placeholderThis block is placed on each chapter front page, e.g")
      .click()
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(100)
    await page.getByLabel("Options", { exact: true }).click()
    await page.getByRole("menuitem", { name: "Add after Ctrl+Alt+Y" }).click()
    await page
      .getByRole("document", {
        name: "Empty block; start writing or type forward slash to choose a block",
      })
      .fill("/spa")
    await page.getByRole("option", { name: "Spacer" }).click()
    await page.getByLabel("Block: Paragraph").first().click()
    await page
      .getByLabel("Block: Paragraph")
      .first()
      .fill("This text should remain editable. Yes, I can edit!")
  })
})
