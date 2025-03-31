import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

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

test("Changing view in the cms sidebar works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Mathematics and Statistics").click(),
  ])

  await page
    .locator("[aria-label=\"Manage\\ course\\ \\'Introduction\\ to\\ Statistics\\'\"] svg")
    .click()

  await page.getByText("Pages").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/f307d05f-be34-4148-bb0c-21d6f7a35cdb/pages",
  )

  await page.getByText("Edit page").click()

  await page.getByText("Welcome to...").click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "block-properties",
    waitForTheseToBeVisibleAndStable: [
      page.getByRole("heading", { name: "Landing Page Hero Section" }),
    ],
    axeSkip: gutenbergAxeSkip,
    skipMobile: true,
  })

  // Select block-list
  await page.locator("select").selectOption("block-list")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "block-list",
    waitForTheseToBeVisibleAndStable: [page.getByText("Course Objective Section").first()],
    axeSkip: gutenbergAxeSkip,
    skipMobile: true,
  })

  // Select block-menu
  await page.locator("select").selectOption("block-menu")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "block-menu",
    waitForTheseToBeVisibleAndStable: [page.getByRole("option", { name: "List", exact: true })],
    axeSkip: gutenbergAxeSkip,
    skipMobile: true,
  })
})
