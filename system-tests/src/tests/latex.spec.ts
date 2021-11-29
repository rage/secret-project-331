import { test } from "@playwright/test"

import expectPath from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("latex-block renders", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Mathematics and Statistics
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
  ])
  // Click text=Add course
  await page.click(`button:text("Create")`)
  // Click input[type="text"]
  await page.click('input[type="text"]')
  // Fill input[type="text"]
  await page.fill('input[type="text"]', "Latex course")

  await page.fill('input[id="teacher-in-charge-name"]', "teacher")
  await page.fill('input[id="teacher-in-charge-email"]', "teacher@example.com")

  // Click text=Create course
  await page.click(`button:text("Create"):below(:text("Course language"))`)
  // Click :nth-match(:text("Manage"), 2)
  await Promise.all([page.waitForNavigation(), page.click(':nth-match(:text("Manage"), 2)')])

  expectPath(page, "/manage/courses/[id]")
  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Manage pages")])
  expectPath(page, "/manage/courses/[id]/pages")
  // Click text=Add new chapter
  await page.click(`:nth-match(button:has-text("New"):below(:text("Chapters")), 1)`)
  // Click input[type="text"]
  await page.click('input[type="text"]')
  // Fill input[type="text"]
  await page.fill('input[type="text"]', "first page")
  // Click text=Create chapter
  await page.click(`button:text("Create")`)
  // Click a:has-text("first page")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/f2f1482e-4f49-4f6e-a5ef-99ac1513d97c' }*/),
    page.click('a:has-text("first page")'),
  ])
  // - PROGRESS
  // Click text=Chapter Progress PlaceholderThis block is used to display Chapter progress. To d
  await page.click(
    "text=Chapter Progress PlaceholderThis block is used to display Chapter progress. To d",
  )
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove blockShift+Alt+Z")
  // - CHAPTER GRID
  await page.click("text=Pages in chapter placeholder")
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove blockShift+Alt+Z")
  // - EXERCISES
  await page.click(
    "text=Exercises In Chapter PlaceholderThis block is placed on each chapter front page,",
  )
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove blockShift+Alt+Z")
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove blockShift+Alt+Z")
  // - CREATE LATEX BLOCK
  // Click text=No block selected.Pages In Chapter Grid PlaceholderThis block is placed on each  >> button
  await page.click('[aria-label="Add block"]')

  // Click [placeholder="Search"]
  await page.click('[placeholder="Search"]')
  // Fill [placeholder="Search"]
  await page.fill('[placeholder="Search"]', "latex")
  // Click button[role="option"]:has-text("Latex Block")
  await page.click('button[role="option"]:has-text("Latex Block")')
  // Fill textarea
  await page.fill("textarea", "\\int^\\infty_{-\\infty} e^{-x^2} dx = \\sqrt{\\pi}")

  // Click p[role="button"]
  await page.click('p[role="button"]')
  // Press Enter
  await page.type(
    '[aria-label="Empty block; start writing or type forward slash to choose a block"]',
    "Inline latex: [latex]e = \\lim_{n \\rightarrow \\infty} (1 + \\frac{1}{n})^n[/latex]",
  )
  await page.press(
    "text=Inline latex: [latex]e = \\lim_{n \\rightarrow \\infty} (1 + \\frac{1}{n})^n[/latex]",
    "Enter",
  )
  // Press Enter
  await page.type(
    '[aria-label="Empty block; start writing or type forward slash to choose a block"]',
    "Wubba Lubba Dub Dub",
  )

  // Click button:has-text("Save")
  await page.click('button:has-text("Save")')

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click('[aria-label="Home page"]'),
  ])
  // Click text=University of Helsinki, Department of Mathematics and Statistics
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
  ])
  expectPath(page, "/org/uh-mathstat")
  // Click text=Latex course
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/latex-course' }*/),
    page.click("text=Latex course"),
  ])
  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')
  // Click text=Chapter 1: first page
  await Promise.all([page.waitForNavigation(), page.click("text=first page")])
  expectPath(page, "org/uh-mathstat/courses/latex-course/chapter-1")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "latex",
    waitForThisToBeVisibleAndStable: ["text=Inline latex", "text=Wubba Lubba Dub Dub"],
  })
})
