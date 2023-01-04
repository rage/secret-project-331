import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("mange course structure works", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])

  // Click [aria-label="Manage\ course\ \'Introduction\ to\ everything\'"] svg
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5' }*/),
    page.click("[aria-label=\"Manage\\ course\\ \\'Course\\ Structure\\'\"] svg"),
  ])
  // Click text=Pages
  await page.click("text=Pages")
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/86cbc198-601c-42f4-8e0f-3e6cce49bbfc/pages",
  )
  // Click text=Page One/chapter-1/page-1Edit page >> [aria-label="Dropdown\ menu"]
  await page.click('text=Page One/chapter-1/page-1Edit page >> [aria-label="Dropdown\\ menu"]')
  // Click text=Move down
  await page.click("text=Move down")
  // Click text=Page 6/chapter-1/page-6Edit page >> [aria-label="Dropdown\ menu"]
  await page.click('text=Page 6/chapter-1/page-6Edit page >> [aria-label="Dropdown\\ menu"]')
  // Click text=Move up
  await page.click("text=Move up")
  // Click button:text-is("Save")
  await page.click('button:text-is("Save")')
  // Click text=Operation successful!
  await page.waitForSelector("text=Operation successful!")
  // Check that the order is now right
  await page.waitForTimeout(100)
  await page.waitForSelector(`:text("Page One"):below(:text("Page 2"))`)
  await page.waitForSelector(`:text("Page 5"):below(:text("Page 6"))`)

  // Click text=Page 4/chapter-1/page-4Edit page >> [aria-label="Dropdown\ menu"]
  await page.click('text=Page 4/chapter-1/page-4Edit page >> [aria-label="Dropdown\\ menu"]')
  // Click text=Delete
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.click("text=Delete")
  // Click button:text-is("Save")
  await page.click('button:text-is("Save")')
  // Click text=Chapter 2: The intermediariesChapter front pageTitleURL pathThe intermediaries/c >> [aria-label="Dropdown\ menu"]
  await page.click(
    'text=Chapter 2: The intermediariesChapter front pageTitleURL pathHiddenThe intermediaries/c >> [aria-label="Dropdown\\ menu"]',
  )
  // Click text=EditDelete >> button
  await page.locator(`button:text-is("Edit")`).click()
  // Click [placeholder="Name"]
  await page.click('[placeholder="Name"]')
  // Click [placeholder="Name"]
  await page.click('[placeholder="Name"]')
  // Press ArrowRight
  await page.press('[placeholder="Name"]', "ArrowRight")
  // Fill [placeholder="Name"]
  await page.fill('[placeholder="Name"]', "The intermediaries TEST change")
  // Check text=Set DeadlineDeadline >> input[type="checkbox"]
  await page.check('input[label="Set Deadline"]')
  // Click [placeholder="Deadline"]
  await page.click('[placeholder="Deadline"]')
  // Click [placeholder="Deadline"]
  await page.fill('[placeholder="Deadline"]', "2050-01-01T23:59:13")
  // Click text=Update
  await page.click("text=Update")
  // Click text=Operation successful!
  await page.waitForSelector("text=Operation successful!")
  await page.waitForTimeout(100)
  // Check if the rename is visible on the page
  await page.waitForSelector(`:text("The intermediaries TEST change")`)

  // Click text=Page 4/chapter-1/page-4Edit page >> :nth-match(div, 2)
  await page.click("text=Page 3/chapter-1/page-3Edit page >> :nth-match(div, 2)")
  // Click text=Delete
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page.click("text=Delete")
  // Click text=Successfully deleted
  await page.waitForSelector("text=Successfully deleted")
  // Click button:text-is("Save")
  await page.click('button:text-is("Save")')
  // Click text=Operation successful!
  await page.waitForSelector("text=Operation successful!")

  // Click text=Chapter 1: The Basics >> [aria-label="Dropdown\ menu"]
  await page.click('text=Chapter 1: The Basics >> [aria-label="Dropdown\\ menu"]')
  // Click text=Move down
  await page.click("text=Move down")
  // Click button:text-is("Save")
  await page.click('button:text-is("Save")')
  // Click text=Operation successful!
  await page.waitForSelector("text=Operation successful!")

  await page.waitForSelector(
    `:text("Chapter 2: The Basics"):below(:text("Chapter 1: The intermediaries TEST change"))`,
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "manage-course-structure-middle-of-the-page",
    clearNotifications: true,
  })

  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "manage-course-structure-top-of-the-page",
    clearNotifications: true,
  })
})
