import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const gutenbergAxeSkip = [
  "aria-allowed-attr", // gutenberg blocks use disallowed attributes that we can't control
  "aria-allowed-role", // the editor contains elements that are not supposed to be editable (e.g. h1 with textbox role)
  "color-contrast", // the gutenberg block lists don't have a high enough constrast
  "aria-hidden-focus", // Gutengerg draggable thing does not have a tabindex -1,
  "aria-required-children",
]

test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Mathematics and Statistics
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-mathstat' }*/),
    page.locator("text=University of Helsinki, Department of Mathematics and Statistics").click(),
  ])

  // Click [aria-label="Manage\ course\ \'Introduction\ to\ Statistics\'"] svg
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/f307d05f-be34-4148-bb0c-21d6f7a35cdb' }*/),
    page
      .locator("[aria-label=\"Manage\\ course\\ \\'Introduction\\ to\\ Statistics\\'\"] svg")
      .click(),
  ])

  // Click text=Pages
  await page.locator("text=Pages").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/f307d05f-be34-4148-bb0c-21d6f7a35cdb/pages",
  )

  // Click a:has-text("Introduction to Statistics")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/8bd4a252-b275-40b2-b60b-917125a2a020' }*/),
    page.locator("text=Edit page").click(),
  ])

  // Click text=Welcome to...
  await page.locator("text=Welcome to...").click()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "block-properties",
    waitForThisToBeVisibleAndStable: "text=Landing page hero section",
    axeSkip: gutenbergAxeSkip,
    skipMobile: true,
  })

  // Select block-list
  await page.locator("select").selectOption("block-list")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "block-list",
    waitForThisToBeVisibleAndStable: "text=Course Objective Section",
    axeSkip: gutenbergAxeSkip,
    skipMobile: true,
  })

  // Select block-menu
  await page.locator("select").selectOption("block-menu")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "block-menu",
    waitForThisToBeVisibleAndStable: "text=Pullquote",
    axeSkip: gutenbergAxeSkip,
    skipMobile: true,
  })
})
