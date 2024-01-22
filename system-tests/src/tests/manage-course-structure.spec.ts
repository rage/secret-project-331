import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("manage course structure works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])

  await page.locator("[aria-label=\"Manage\\ course\\ \\'Course\\ Structure\\'\"] svg").click()

  await page.locator("text=Pages").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/86cbc198-601c-42f4-8e0f-3e6cce49bbfc/pages",
  )
  // Make sure the first two chapters have the right order
  await page.waitForSelector(
    `:text("Chapter 1: The Basics"):above(:text("Chapter 2: The intermediaries"))`,
  )
  // Swap the order of the first two chapters
  await page
    .getByRole("heading", { name: "Chapter 1: The Basics Dropdown menu" })
    .getByRole("button", { name: "Dropdown menu" })
    .click()
  await page.getByRole("button", { name: "Move down" }).click()
  // The order should have changed
  await page.waitForSelector(
    `:text("Chapter 2: The Basics"):below(:text("Chapter 1: The intermediaries"))`,
  )
  // Saving should work and the order should be saved
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.waitForSelector(
    `:text("Chapter 2: The Basics"):below(:text("Chapter 1: The intermediaries"))`,
  )
  // Now if we switch the chapters back, the order should reset to normal and there should be no errors for example from duplicate redirections
  await page
    .getByRole("heading", { name: "Chapter 2: The Basics Dropdown menu" })
    .getByRole("button", { name: "Dropdown menu" })
    .click()
  await page.getByRole("button", { name: "Move up" }).click()
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.waitForSelector(
    `:text("Chapter 1: The Basics"):above(:text("Chapter 2: The intermediaries"))`,
  )

  // Test moving pages around
  await page.click('text=Page One/chapter-1/page-1Edit page >> [aria-label="Dropdown\\ menu"]')

  await page.locator("text=Move down").click()

  await page.click('text=Page 6/chapter-1/page-6Edit page >> [aria-label="Dropdown\\ menu"]')

  await page.locator("text=Move up").click()

  await page.click('button:text-is("Save")')

  await page.waitForSelector("text=Operation successful!")
  // Check that the order is now right
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  await page.waitForSelector(`:text("Page One"):below(:text("Page 2"))`)
  await page.waitForSelector(`:text("Page 5"):below(:text("Page 6"))`)

  await page.click('text=Page 4/chapter-1/page-4Edit page >> [aria-label="Dropdown\\ menu"]')

  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.locator("text=Delete").click()

  await page.click('button:text-is("Save")')
  await page.waitForSelector("text=Operation successful!")
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

  await page.locator("text=Update").click()

  await page.waitForSelector("text=Operation successful!")
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(100)
  // Check if the rename is visible on the page
  await page.waitForSelector(`:text("The intermediaries TEST change")`)

  await page.locator("text=Page 3/chapter-1/page-3Edit page >> :nth-match(div, 2)").click()

  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.locator("text=Delete").click()

  await page.waitForSelector("text=Successfully deleted")

  await page.click('button:text-is("Save")')

  await page.waitForSelector("text=Operation successful!")

  await page.click('text=Chapter 1: The Basics >> [aria-label="Dropdown\\ menu"]')

  await page.locator("text=Move down").click()

  await page.click('button:text-is("Save")')

  await page.waitForSelector("text=Operation successful!")

  await page.waitForSelector(
    `:text("Chapter 2: The Basics"):below(:text("Chapter 1: The intermediaries TEST change"))`,
  )

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
