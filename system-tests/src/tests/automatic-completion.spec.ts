import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Registers automatic completion", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page
      .locator(
        '[aria-label="University of Helsinki\\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")',
      )
      .first()
      .click(),
  ])
  // Click text=Automatic CompletionsSample course.LanguageEnglish
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/automatic-completions' }*/),
    page.locator("text=Automatic CompletionsSample course.LanguageEnglish").click(),
  ])
  // Click label:has-text("Default") >> nth=0
  await page.locator('label:has-text("Default")').first().click()
  // Click button:has-text("Continue")
  await page.locator('button:has-text("Continue")').click()
  // Click text=Chapter 1The Basics
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/automatic-completions/chapter-1' }*/),
    page.locator("text=Chapter 1The Basics").click(),
  ])
  // Click text=1Page One
  await page.locator("text=1Page One").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/automatic-completions/chapter-1/page-1",
  )
  // Click text=b
  await page.frameLocator("iframe").locator("text=b").click()
  // Click text=Submit
  await page.locator('button:has-text("Submit")').click()
  // Click text=Automatic Completions
  await page.locator("text=Automatic Completions").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/automatic-completions")
  await page.waitForSelector("text=Congratulations!")
  await expectScreenshotsToMatchSnapshots({
    page,
    headless: headless ?? false,
    snapshotName: "automatic-completion-congratulations-card",
    waitForThisToBeVisibleAndStable: [
      "text=Congratulations!",
      "text=You have successfully completed the course!",
    ],
    toMatchSnapshotOptions: { threshold: 0.3 },
    beforeScreenshot: () => page.locator("text=Congratulations!").scrollIntoViewIfNeeded(),
  })
  // Click text=Automatic CompletionsRegisterGenerate certificate >> button
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/completion-registration/878b7205-0e13-42be-90b9-3571bb6626c9' }*/),
    page.locator("text=Automatic CompletionsRegisterGenerate certificate >> button").click(),
  ])
  await expectScreenshotsToMatchSnapshots({
    page,
    headless: headless ?? false,
    snapshotName: "automatic-completion-registration-page",
    waitForThisToBeVisibleAndStable: "text=Register completion",
    toMatchSnapshotOptions: { threshold: 0.3 },
  })
  // Click text=To the registration form
  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://www.example.com/' }*/),
    page.locator("text=To the registration form").click(),
  ])
  await expect(page).toHaveURL("https://www.example.com")
})
