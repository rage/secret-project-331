import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Editing exam instructions works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    page.click(
      '[aria-label="University\\ of\\ Helsinki\\,\\ Department\\ of\\ Computer\\ Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  await page
    .getByTestId("exam-list-item")
    .filter({ hasText: "Ongoing short timer" })
    .getByRole("link", { name: "Manage" })
    .click()

  await page.getByText("Edit exam instructions").click()

  await page.locator(`[aria-label="Add default block"]`).click()
  await page
    .locator(`[aria-label="Empty block; start writing or type forward slash to choose a block"]`)
    .type(`/heading`)

  await page.click(`button[role="option"]:has-text("Heading")`)
  await page.type(`[aria-label="Block\\:\\ Heading"]`, "Lorem Ipsum Exam")

  await page.press('[aria-label="Block\\:\\ Heading"]', "Enter")

  await page.type(
    `[aria-label="Empty block; start writing or type forward slash to choose a block"]`,
    "These are the instructions",
  )
  await page.press(`text=These are the instructions`, "Enter")
  await page.type(
    `[aria-label="Empty\\ block\\;\\ start\\ writing\\ or\\ type\\ forward\\ slash\\ to\\ choose\\ a\\ block"]`,
    "/",
  )

  await page.getByText("List").click()

  await page.getByRole("textbox", { name: "List text" }).click()
  await page.getByRole("textbox", { name: "List text" }).fill("One")
  await page.getByRole("textbox", { name: "List text" }).press("Enter")
  await page.getByRole("textbox", { name: "List text" }).nth(1).fill("Two")

  await page.locator(`button:text-is("Save")`).click()

  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(200)

  await page.goto("http://project-331.local/org/uh-cs")

  await page.getByText("Ongoing short timer").click()
  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page.locator("id=exam-instructions"),
    snapshotName: "exam-instructions",
    waitForTheseToBeVisibleAndStable: [page.getByText("These are the instructions")],
  })
})
