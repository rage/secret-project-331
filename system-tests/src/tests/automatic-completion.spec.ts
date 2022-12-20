import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Registers automatic completion", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click(),
  ])
  // Click text=Automatic Completions
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/automatic-completions' }*/),
    page.locator("text=Automatic Completions").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

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
  // Have to wait until the submit is done
  await page.getByText(`Good job!`).waitFor()

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
  // Click text=Automatic CompletionsRegister >> button
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/completion-registration/878b7205-0e13-42be-90b9-3571bb6626c9' }*/),
    page.locator("text=Automatic CompletionsRegister >> button").click(),
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

  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click(),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.getByRole("link", { name: "Manage course 'Automatic Completions'" }).click(),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/b39b64f3-7718-4556-ac2b-333f3ed4096f",
  )

  await Promise.all([page.waitForNavigation(), page.getByRole("tab", { name: "Modules" }).click()])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/b39b64f3-7718-4556-ac2b-333f3ed4096f/modules",
  )

  // Change default module options
  await page
    .locator('form:has-text("Default module")')
    .getByRole("button", { name: "Edit" })
    .click()
  // await page.locator('[aria-label="Edit"]').nth(1).click()
  await page.getByLabel("Override completion registration link").check()
  await page.getByPlaceholder("Completion registration link").click()
  await page
    .getByPlaceholder("Completion registration link")
    .fill("https://www.example.com/override")
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByRole("button", { name: "Save changes" }).click()

  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  // Click [aria-label="University of Helsinki\, Department of Computer Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click(),
  ])
  // Click text=Automatic Completions
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/automatic-completions' }*/),
    page.locator("text=Automatic Completions").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/automatic-completions")
  await page.waitForSelector("text=Congratulations!")
  // Click text=Automatic CompletionsRegister >> button
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/completion-registration/878b7205-0e13-42be-90b9-3571bb6626c9' }*/),
    page.locator("text=Automatic CompletionsRegister >> button").click(),
  ])
  // Click text=To the registration form
  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://www.example.com/' }*/),
    page.locator("text=To the registration form").click(),
  ])
  await expect(page).toHaveURL("https://www.example.com/override")
})
