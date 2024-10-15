import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Registers automatic completion", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()

  await page.getByText("Automatic Completions").click()

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("Chapter 1The Basics").click()

  await page.getByText("1Page One").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/automatic-completions/chapter-1/page-1",
  )

  await page.frameLocator("iframe").getByText("b").click()

  await page.locator('button:has-text("Submit")').click()
  // Have to wait until the submit is done
  await page.getByText(`Good job!`).waitFor()

  await page.getByText("Automatic Completions").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/automatic-completions")
  await page.getByText("Congratulations!").waitFor()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "automatic-completion-congratulations-card",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Congratulations!"),
      page.getByText("You have successfully completed the course!"),
    ],
    // reset to top before beforeScreenshot so that scrollIntoViewIfNeeded lands in a consistent spot
    scrollToYCoordinate: 0,
    beforeScreenshot: () => page.getByText("Congratulations!").scrollIntoViewIfNeeded(),
  })

  await page
    .getByLabel("Register completion for Automatic Completions")
    .getByRole("button", { name: "Register" })
    .click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "automatic-completion-registration-page",
    waitForTheseToBeVisibleAndStable: [page.getByText("Register completion")],
  })

  await page.getByText("To the registration form").click()
  await expect(page).toHaveURL("https://www.example.com")

  await page.goto("http://project-331.local/organizations")

  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()

  await Promise.all([
    page.getByRole("link", { name: "Manage course 'Automatic Completions'" }).click(),
  ])
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/b39b64f3-7718-4556-ac2b-333f3ed4096f",
  )

  await Promise.all([page.getByRole("tab", { name: "Modules" }).click()])
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
  await page.getByLabel("Confirm").click()
  await page.getByRole("button", { name: "Save changes" }).click()

  await page.goto("http://project-331.local/organizations")

  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()

  await page.getByText("Automatic Completions").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/automatic-completions")
  await page.getByText("Congratulations!").waitFor()

  await page
    .getByLabel("Register completion for Automatic Completions")
    .getByRole("button", { name: "Register" })
    .click()

  await page.getByText("To the registration form").click()
  await expect(page).toHaveURL("https://www.example.com/override")
})
