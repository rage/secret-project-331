import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Registers automatic completion", async ({ headless, page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/automatic-completions' }*/),
    page.locator("text=Automatic Completions").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/automatic-completions/chapter-1' }*/),
    page.locator("text=Chapter 1The Basics").click(),
  ])

  await page.locator("text=1Page One").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/automatic-completions/chapter-1/page-1",
  )

  await page.frameLocator("iframe").locator("text=b").click()

  await page.locator('button:has-text("Submit")').click()
  // Have to wait until the submit is done
  await page.getByText(`Good job!`).waitFor()

  await page.locator("text=Automatic Completions").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/automatic-completions")
  await page.waitForSelector("text=Congratulations!")
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless: headless ?? false,
    snapshotName: "automatic-completion-congratulations-card",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Congratulations!"),
      page.locator("text=You have successfully completed the course!"),
    ],

    beforeScreenshot: () => page.locator("text=Congratulations!").scrollIntoViewIfNeeded(),
  })

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/completion-registration/878b7205-0e13-42be-90b9-3571bb6626c9' }*/),
    page.locator("text=Automatic CompletionsRegister >> button").click(),
  ])
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless: headless ?? false,
    snapshotName: "automatic-completion-registration-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Register completion")],
  })

  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://www.example.com/' }*/),
    page.locator("text=To the registration form").click(),
  ])
  await expect(page).toHaveURL("https://www.example.com")

  await page.goto("http://project-331.local/")

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

  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page
      .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
      .click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/automatic-completions' }*/),
    page.locator("text=Automatic Completions").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/automatic-completions")
  await page.waitForSelector("text=Congratulations!")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/completion-registration/878b7205-0e13-42be-90b9-3571bb6626c9' }*/),
    page.locator("text=Automatic CompletionsRegister >> button").click(),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://www.example.com/' }*/),
    page.locator("text=To the registration form").click(),
  ])
  await expect(page).toHaveURL("https://www.example.com/override")
})
