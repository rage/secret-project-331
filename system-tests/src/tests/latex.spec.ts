/* eslint-disable playwright/no-wait-for-timeout */
import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("latex-block renders", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    await page
      .getByText("University of Helsinki, Department of Mathematics and Statistics")
      .click(),
  ])

  await page.getByRole("button", { name: "Create", exact: true }).first().click()

  await page.click('input[type="radio"]')
  // Fill input[type="text"]
  await page.fill("text=Name", "Latex course")

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  await page.click(`button:text("Create"):below(:text("Course language"))`)

  await page.locator("[aria-label=\"Manage course 'Latex course'\"] svg").click()
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

  await page.getByText("Pages").click()
  await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")

  await page.click(`:nth-match(button:has-text("New chapter"), 1)`)

  // Fill input[type="text"]
  await page.fill(`label:has-text("Name")`, "first page")

  await page.click(`button:text("Create")`)

  await page.click(`button:text("Edit page"):right-of(:text("first page"))`)
  // - CHAPTER GRID
  await page.getByText("Pages in chapter placeholder").click()
  await page.waitForTimeout(100)

  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)

  await page.getByText("Delete").click()
  await page.waitForTimeout(100)
  // - EXERCISES
  await page.click(
    "text=Exercises In Chapter PlaceholderThis block is placed on each chapter front page,",
  )
  await page.waitForTimeout(100)

  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)

  await page.getByText("Delete").click()
  await page.waitForTimeout(100)

  await page.click('[aria-label="Options"]')
  await page.waitForTimeout(100)

  await page.getByText("Delete").click()
  await page.waitForTimeout(100)
  // - CREATE LATEX BLOCK

  await page
    .locator('[aria-label="Empty block\\; start writing or type forward slash to choose a block"]')
    // eslint-disable-next-line playwright/no-force-option
    .click({ force: true })

  await page
    .locator('[aria-label="Empty block\\; start writing or type forward slash to choose a block"]')
    .type(`/latex`)

  await page.click('button[role="option"]:has-text("Latex")')
  // Fill textarea
  await page.fill("textarea", "\\int^\\infty_{-\\infty} e^{-x^2} dx = \\sqrt{\\pi}")
  // Focus the block
  await page.locator("textarea").click()

  await page.click(`[aria-label="Options"]`)
  await page.waitForTimeout(100)
  await page.click(`text=Add after`)
  await page.waitForTimeout(100)

  await page.click(
    `[aria-label="Empty block; start writing or type forward slash to choose a block"]`,
    // eslint-disable-next-line playwright/no-force-option
    { force: true },
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
  await page.waitForTimeout(200)

  await page.goto(`http://project-331.local/org/uh-mathstat`)
  // Click text=Latex course
  await page.getByText("Latex course").click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("first page").click()
  await expectUrlPathWithRandomUuid(page, "/org/uh-mathstat/courses/latex-course/chapter-1")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "latex",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Inline latex"),
      page.getByText("Wubba Lubba Dub Dub"),
    ],
  })
})
