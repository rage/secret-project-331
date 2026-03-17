import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Editing exam instructions works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    await selectOrganization(page, "University of Helsinki, Department of Computer Science"),
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
    .pressSequentially(`/heading`)

  await page.getByRole("option", { name: "Heading", exact: true }).click()
  await page.getByRole("document", { name: "Block: Heading" }).fill("Lorem Ipsum Exam")

  await page.getByRole("document", { name: "Block: Heading" }).press("Enter")

  await page
    .locator(`[aria-label="Empty block; start writing or type forward slash to choose a block"]`)
    .fill("These are the instructions")
  await page.getByText("These are the instructions").press("Enter")
  await page
    .locator(
      `[aria-label="Empty\\ block\\;\\ start\\ writing\\ or\\ type\\ forward\\ slash\\ to\\ choose\\ a\\ block"]`,
    )
    .pressSequentially("/")

  await page.getByText("List").click()

  await page.getByRole("textbox", { name: "List text" }).click()
  await page.getByRole("textbox", { name: "List text" }).fill("One")
  await page.getByRole("textbox", { name: "List text" }).press("Enter")
  await page.getByRole("textbox", { name: "List text" }).nth(1).fill("Two")

  await waitForSuccessNotification(page, async () => {
    await page.locator(`button:text-is("Save")`).click()
  })

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
