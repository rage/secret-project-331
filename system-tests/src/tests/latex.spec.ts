import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("latex-block renders", async ({ headless, page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
  ])

  await page.click(`button:text("Create")`)

  await page.click('input[type="radio"]')
  // Fill input[type="text"]
  await page.fill("text=Name", "Latex course")

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  await page.click(`button:text("Create"):below(:text("Course language"))`)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/courses/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5' }*/),
    page.click("[aria-label=\"Manage course 'Latex course'\"] svg"),
  ])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  await Promise.all([page.waitForNavigation(), page.click("text=Pages")])
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")

  await page.click(`:nth-match(button:has-text("New chapter"), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Name")`, "first page")

  await page.click(`button:text("Create")`)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/f2f1482e-4f49-4f6e-a5ef-99ac1513d97c' }*/),
    page.click(`button:text("Edit page"):right-of(:text("first page"))`),
  ])
  // - PROGRESS

  await page.click(
    "text=Chapter Progress PlaceholderThis block is used to display Chapter progress. To d",
  )
  await page.waitForTimeout(100)

  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)

  await page.click("text=Remove Chapter Progress")
  await page.waitForTimeout(100)
  // - CHAPTER GRID
  await page.click("text=Pages in chapter placeholder")
  await page.waitForTimeout(100)

  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)

  await page.click("text=Remove Pages In Chapter")
  await page.waitForTimeout(100)
  // - EXERCISES
  await page.click(
    "text=Exercises In Chapter PlaceholderThis block is placed on each chapter front page,",
  )
  await page.waitForTimeout(100)

  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)

  await page.click("text=Remove Exercises In Chapter")
  await page.waitForTimeout(100)

  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)

  await page.click("text=Remove Hero Section")
  await page.waitForTimeout(100)
  // - CREATE LATEX BLOCK

  await page
    .locator('[aria-label="Empty block\\; start writing or type forward slash to choose a block"]')
    .click()

  await page
    .locator('[aria-label="Empty block\\; start writing or type forward slash to choose a block"]')
    .type(`/latex`)

  await page.click('button[role="option"]:has-text("Latex")')
  // Fill textarea
  await page.fill("textarea", "\\int^\\infty_{-\\infty} e^{-x^2} dx = \\sqrt{\\pi}")
  // Focus the block
  await page.click("textarea")

  await page.click(`[aria-label="Options"]`)
  await page.waitForTimeout(100)
  await page.click(`text=Insert after`)
  await page.waitForTimeout(100)

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

  await page.click('button:text-is("Save") >> visible=true')

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click('[aria-label="Home page"]'),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Mathematics and Statistics"),
  ])
  await expectUrlPathWithRandomUuid(page, "/org/uh-mathstat")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/latex-course' }*/),
    page.click("text=Latex course"),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([page.waitForNavigation(), page.click("text=first page")])
  await expectUrlPathWithRandomUuid(page, "/org/uh-mathstat/courses/latex-course/chapter-1")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "latex",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Inline latex"),
      page.locator("text=Wubba Lubba Dub Dub"),
    ],
  })
})
