import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
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
  await page.click('input[type="radio"]')
  // Fill input[type="text"]
  await page.fill("text=Name", "Latex course")

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  // Click text=Create course
  await page.click(`button:text("Create"):below(:text("Course language"))`)
  // Click :nth-match(:text("Manage"), 2)
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5' }*/),
    page.click("[aria-label=\"Manage course 'Latex course'\"] svg"),
  ])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")
  // Click text=Manage pages
  await Promise.all([page.waitForNavigation(), page.click("text=Pages")])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")
  // Click text=Add new chapter
  await page.click(`:nth-match(button:has-text("New chapter"), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Name")`, "first page")
  // Click text=Create chapter
  await page.click(`button:text("Create")`)
  // Click a:has-text("first page")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/f2f1482e-4f49-4f6e-a5ef-99ac1513d97c' }*/),
    page.click(`button:text("Edit page"):right-of(:text("first page"))`),
  ])
  // - PROGRESS
  // Click text=Chapter Progress PlaceholderThis block is used to display Chapter progress. To d
  await page.click(
    "text=Chapter Progress PlaceholderThis block is used to display Chapter progress. To d",
  )
  await page.waitForTimeout(100)
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove Chapter Progress")
  await page.waitForTimeout(100)
  // - CHAPTER GRID
  await page.click("text=Pages in chapter placeholder")
  await page.waitForTimeout(100)
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove Pages In Chapter")
  await page.waitForTimeout(100)
  // - EXERCISES
  await page.click(
    "text=Exercises In Chapter PlaceholderThis block is placed on each chapter front page,",
  )
  await page.waitForTimeout(100)
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove Exercises In Chapter")
  await page.waitForTimeout(100)
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)
  // Click text=Remove blockShift+Alt+Z
  await page.click("text=Remove Hero Section")
  await page.waitForTimeout(100)
  // - CREATE LATEX BLOCK
  // Click text=No block selected.Pages In Chapter Grid PlaceholderThis block is placed on each  >> button
  // Click [aria-label="Empty block\; start writing or type forward slash to choose a block"]
  await page
    .locator('[aria-label="Empty block\\; start writing or type forward slash to choose a block"]')
    .click()
  // Click button[role="option"]:has-text("Latex")
  await page
    .locator('[aria-label="Empty block\\; start writing or type forward slash to choose a block"]')
    .type(`/latex`)
  // Click button[role="option"]:has-text("Latex Block")
  await page.click('button[role="option"]:has-text("Latex")')
  // Fill textarea
  await page.fill("textarea", "\\int^\\infty_{-\\infty} e^{-x^2} dx = \\sqrt{\\pi}")
  // Focus the block
  await page.click("textarea")

  await page.click(`[aria-label="Options"]`)
  await page.waitForTimeout(100)
  await page.click(`text=Insert after`)
  await page.waitForTimeout(100)

  // Click p[role="button"]
  await page.click(
    `[aria-label="Empty block; start writing or type forward slash to choose a block"]`,
  )
  await page.type(
    `[aria-label="Empty block; start writing or type forward slash to choose a block"]`,
    "Inline latex: [latex]e = \\lim_{n \\rightarrow \\infty} (1 + \\frac{1}{n})^n[/latex]",
  )
  await page.press(
    "text=Inline latex: [latex]e = \\lim_{n \\rightarrow \\infty} (1 + \\frac{1}{n})^n[/latex]",
    "Enter",
  )
  await page.type(
    '[aria-label="Empty block; start writing or type forward slash to choose a block"]',
    "Wubba Lubba Dub Dub",
  )

  // Click button:text-is("Save")
  await page.click('button:text-is("Save") >> visible=true')

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.getByRole("link", { name: "Home" }).click(),
  ])
  // Click text=University of Helsinki, Department of Mathematics and Statistics
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
  ])
  await expectUrlPathWithRandomUuid(page, "/org/uh-mathstat")
  // Click text=Latex course
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/latex-course' }*/),
    page.click("text=Latex course"),
  ])
  // Click button:has-text("Continue")
  await selectCourseInstanceIfPrompted(page)
  // Click text=Chapter 1: first page
  await Promise.all([page.waitForNavigation(), page.click("text=first page")])
  await expectUrlPathWithRandomUuid(page, "/org/uh-mathstat/courses/latex-course/chapter-1")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "latex",
    waitForThisToBeVisibleAndStable: ["text=Inline latex", "text=Wubba Lubba Dub Dub"],
  })
})
