import { expect, test } from "@playwright/test"

import expectPath from "../utils/expect"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click text=University of Helsinki, Department of Mathematics and Statistics
  await page.click("text=University of Helsinki, Department of Mathematics and Statistics")
  expectPath(page, "/organizations/[id]")
  // Click text=Add course
  await page.click("text=Add course")
  // Click input[type="text"]
  await page.click('input[type="text"]')
  // Fill input[type="text"]
  await page.fill('input[type="text"]', "Latex course")
  // Click text=Create course
  await page.click("text=Create course")
  // Click :nth-match(:text("Manage"), 2)
  await page.click(':nth-match(:text("Manage"), 2)')

  expectPath(page, "/manage/courses/[id]")
  // Click text=Manage pages
  await page.click("text=Manage pages")
  expectPath(page, "/manage/courses/[id]/pages")
  // Click text=Add new chapter
  await page.click("text=Add new chapter")
  // Click input[type="text"]
  await page.click('input[type="text"]')
  // Fill input[type="text"]
  await page.fill('input[type="text"]', "first page")
  // Click text=Create chapter
  await page.click("text=Create chapter")
  // Click a:has-text("first page")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/pages/f2f1482e-4f49-4f6e-a5ef-99ac1513d97c' }*/),
    page.click('a:has-text("first page")'),
  ])
  // Click text=No block selected.Pages In Chapter Grid PlaceholderThis block is placed on each  >> button
  await page.click(
    "text=No block selected.Pages In Chapter Grid PlaceholderThis block is placed on each  >> button",
  )
  // Click [placeholder="Search"]
  await page.click('[placeholder="Search"]')
  // Fill [placeholder="Search"]
  await page.fill('[placeholder="Search"]', "latex")
  // Click button[role="option"]:has-text("Latex Block")
  await page.click('button[role="option"]:has-text("Latex Block")')
  // Fill textarea
  await page.fill("textarea", "\\mathbb{R}")
  // Click button:has-text("Save")
  await page.click('button:has-text("Save")')
  // Click text=Home
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click("text=Home"),
  ])
  // Click text=University of Helsinki, Department of Mathematics and Statistics
  await page.click("text=University of Helsinki, Department of Mathematics and Statistics")
  expectPath(page, "/organizations/[id]")
  // Click text=Latex course
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/latex-course' }*/),
    page.click("text=Latex course"),
  ])
  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')
  // Click text=Chapter 1: first page
  await page.click("text=Chapter 1: first page")
  expectPath(page, "/courses/latex-course/chapter-1")
  // Click :nth-match(span:has-text("R"), 3)
  await page.click(':nth-match(span:has-text("R"), 3)')
})
