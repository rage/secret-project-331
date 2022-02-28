import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [aria-label="University\ of\ Helsinki\,\ Department\ of\ Computer\ Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click(
      '[aria-label="University\\ of\\ Helsinki\\,\\ Department\\ of\\ Computer\\ Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])
  // Click [aria-label="Manage\ Ongoing\ short\ timer"]
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c' }*/),
    page.click('[aria-label="Manage\\ Ongoing\\ short\\ timer"]'),
  ])
  // Click text=Edit exam instructions
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c/edit' }*/),
    page.click("text=Edit exam instructions"),
  ])
  await page.click(
    "text=Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur bibendum feli",
  )
  // Click [aria-label="Options"]
  await page.click('[aria-label="Options"]')
  // Click text=Remove ParagraphShift+Alt+Z
  await page.click("text=Remove ParagraphShift+Alt+Z")

  await page.type(
    `[aria-label="Empty block; start writing or type forward slash to choose a block"]`,
    "/",
  )
  await page.click("text=Heading")
  await page.type(`[aria-label="Block\\:\\ Heading"]`, "Lorem Ipsum Exam")
  // Press Enter
  await page.press('[aria-label="Block\\:\\ Heading"]', "Enter")
  // Press Enter
  await page.type(
    `[aria-label="Empty block; start writing or type forward slash to choose a block"]`,
    "These are the instructions",
  )
  await page.press(`text=These are the instructions`, "Enter")
  await page.type(
    `[aria-label="Empty\\ block\\;\\ start\\ writing\\ or\\ type\\ forward\\ slash\\ to\\ choose\\ a\\ block"]`,
    "/",
  )
  // Click text=List
  await page.click("text=List")
  // Press Enter
  await page.click('[aria-label="Block\\:\\ List"] li')
  await page.type('[aria-label="Block\\:\\ List"] li', "One")
  await page.press('[aria-label="Block\\:\\ List"]', "Enter")
  await page.type('[aria-label="Block\\:\\ List"] >> :nth-match(li, 2)', "Two")
  // Click text=Save
  await page.click("text=Save")
  // Go to http://project-331.local/org/uh-cs
  await page.goto("http://project-331.local/org/uh-cs")
  // Click text=Ongoing short timer
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c' }*/),
    page.click("text=Ongoing short timer"),
  ])
  await expectScreenshotsToMatchSnapshots({
    headless,
    page,
    elementId: "#exam-instructions",
    snapshotName: "exam-instructions",
    waitForThisToBeVisibleAndStable: "text=These are the instructions",
  })
})
