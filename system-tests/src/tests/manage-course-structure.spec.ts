import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("manage course structure works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage\\ course\\ \\'Course\\ Structure\\'\"] svg").click()

  await page.getByText("Pages").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/86cbc198-601c-42f4-8e0f-3e6cce49bbfc/pages",
  )
  // Make sure the first two chapters have the right order
  await page
    .locator(`:text("Chapter 1: The Basics"):above(:text("Chapter 2: The intermediaries"))`)
    .waitFor()
  // Swap the order of the first two chapters
  await page
    .getByRole("heading", { name: "Chapter 1: The Basics Dropdown menu" })
    .getByRole("button", { name: "Dropdown menu" })
    .click()
  await page.getByRole("button", { name: "Move down" }).click()
  // The order should have changed
  await page
    .locator(`:text("Chapter 2: The Basics"):below(:text("Chapter 1: The intermediaries"))`)
    .waitFor()
  // Saving should work and the order should be saved
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page
    .locator(`:text("Chapter 2: The Basics"):below(:text("Chapter 1: The intermediaries"))`)
    .waitFor()
  // Now if we switch the chapters back, the order should reset to normal and there should be no errors for example from duplicate redirections
  await page
    .getByRole("heading", { name: "Chapter 2: The Basics Dropdown menu" })
    .getByRole("button", { name: "Dropdown menu" })
    .click()
  await page.getByRole("button", { name: "Move up" }).click()
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page
    .locator(`:text("Chapter 1: The Basics"):above(:text("Chapter 2: The intermediaries"))`)
    .waitFor()

  // Test moving pages around
  await page.click('text=Page One/chapter-1/page-1Edit page >> [aria-label="Dropdown\\ menu"]')

  await page.getByText("Move down").click()

  await page.click('text=Page 6/chapter-1/page-6Edit page >> [aria-label="Dropdown\\ menu"]')

  await page.getByText("Move up").click()

  await page.click('button:text-is("Save")')

  await page.getByText("Operation successful!").waitFor()
  // Check that the order is now right
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  await page.locator(`:text("Page One"):below(:text("Page 2"))`).waitFor()
  await page.locator(`:text("Page 5"):below(:text("Page 6"))`).waitFor()

  await page.click('text=Page 4/chapter-1/page-4Edit page >> [aria-label="Dropdown\\ menu"]')

  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.getByText("Delete").click()

  await page.click('button:text-is("Save")')
  await page.getByText("Operation successful!").waitFor()
  await page.reload()

  await page
    .getByRole("heading", { name: "Chapter 2: The intermediaries Dropdown menu" })
    .getByRole("button", { name: "Dropdown menu" })
    .click()

  await page.locator(`button:text-is("Edit")`).click()

  await page.click('[placeholder="Name"]')

  await page.click('[placeholder="Name"]')

  await page.press('[placeholder="Name"]', "ArrowRight")
  // Fill [placeholder="Name"]
  await page.fill('[placeholder="Name"]', "The intermediaries TEST change")
  // Check text=Set DeadlineDeadline >> input[type="checkbox"]
  await page.check('input[label="Set Deadline"]')

  await page.click('[placeholder="Deadline"]')

  await page.fill('[placeholder="Deadline"]', "2050-01-01T23:59:13")

  await page.getByText("Update").click()

  await page.getByText("Operation successful!").waitFor()
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  // Check if the rename is visible on the page
  await page.locator(`:text("The intermediaries TEST change")`).waitFor()

  await page
    .getByRole("row", { name: "Page 3 /chapter-1/page-3 Edit" })
    .getByLabel("Dropdown menu")
    .click()

  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.getByText("Delete").click()

  await page.getByText("Successfully deleted").waitFor()

  await page.reload()

  await page.click('button:text-is("Save")')

  await page.getByText("Operation successful!").waitFor()

  await page.click('text=Chapter 1: The Basics >> [aria-label="Dropdown\\ menu"]')

  await page.getByText("Move down").click()

  await page.click('button:text-is("Save")')

  await page.getByText("Operation successful!").waitFor()

  await page
    .locator(
      `:text("Chapter 2: The Basics"):below(:text("Chapter 1: The intermediaries TEST change"))`,
    )
    .waitFor()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "manage-course-structure-middle-of-the-page",
    clearNotifications: true,
  })

  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "manage-course-structure-top-of-the-page",
    clearNotifications: true,
  })
})
