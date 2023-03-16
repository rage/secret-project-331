import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.click(
      '[aria-label="University\\ of\\ Helsinki\\,\\ Department\\ of\\ Computer\\ Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
    ),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/manage/exams/7d6ed843-2a94-445b-8ced-ab3c67290ad0' }*/),
    page.locator("text=Ongoing short timerManage >> a").nth(1).click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/cms/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c/edit' }*/),
    page.locator("text=Edit exam instructions").click(),
  ])

  await page.locator(`[aria-label="Add default block"]`).click()
  await page
    .locator(`[aria-label="Empty block; start writing or type forward slash to choose a block"]`)
    .type(`/heading`)

  await page.click(`button[role="option"]:has-text("Heading")`)
  await page.type(`[aria-label="Block\\:\\ Heading"]`, "Lorem Ipsum Exam")

  await page.press('[aria-label="Block\\:\\ Heading"]', "Enter")

  await page.type(
    `[aria-label="Empty block; start writing or type forward slash to choose a block"]`,
    "These are the instructions",
  )
  await page.press(`text=These are the instructions`, "Enter")
  await page.type(
    `[aria-label="Empty\\ block\\;\\ start\\ writing\\ or\\ type\\ forward\\ slash\\ to\\ choose\\ a\\ block"]`,
    "/",
  )

  await page.locator("text=List").click()

  await page
    .locator('[aria-label="Block\\:\\ List item"]')
    .locator(`[aria-label="List text"]`)
    .click()
  await page
    .locator('[aria-label="Block\\:\\ List item"]')
    .locator(`[aria-label="List text"]`)
    .type("One")
  await page
    .locator('[aria-label="Block\\:\\ List item"]')
    .locator(`[aria-label="List text"]`)
    .press("Enter")
  await page
    .locator('[aria-label="Block\\:\\ List item"]')
    .nth(1)
    .locator(`[aria-label="List text"]`)
    .type("Two")

  await page.locator(`button:text-is("Save")`).click()

  await page.goto("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/exams/6959e7af-6b78-4d37-b381-eef5b7aaad6c' }*/),
    page.locator("text=Ongoing short timer").click(),
  ])
  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page.locator("id=exam-instructions"),
    snapshotName: "exam-instructions",
    waitForTheseToBeVisibleAndStable: [page.locator("text=These are the instructions")],
  })
})
