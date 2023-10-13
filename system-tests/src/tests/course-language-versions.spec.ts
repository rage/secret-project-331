import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/language.teacher@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course 'Introduction to localizing'\"] svg").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/639f4d25-9376-49b5-bcca-7cba18c38565",
  )

  await page.getByRole("tab", { name: "Language versions" }).click()

  // Click text=New language version
  await page.click(`:nth-match(button:below(:text("All course language versions")):text("New"), 1)`)

  await page.click('input[type="radio"]')

  // Fill input[type="text"]
  await page.fill("text=Name", "Johdatus lokalisointiin")

  await page.click(':nth-match(input[type="radio"], 2)')

  await page.fill("text=Teacher in charge name", "teacher")
  await page.fill("text=Teacher in charge email", "teacher@example.com")

  await page.fill('textarea:below(:text("Description"))', "Course description")

  await page.click(`button:text("Create")`)
  await page.getByText("Operation successful!").waitFor()

  await Promise.all([page.getByRole("link", { name: "Home" }).click()])

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("text=Johdatus lokalisointiin").click()

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([page.click('#content a >> :nth-match(div:has-text("Luku 1The Basics"), 3)')])

  await page.locator("text=1Page One").click()

  await page.getByText(`Like this.`).first().waitFor()

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-localizing/chapter-1")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "wrong-course-banner",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("You're already on a different language version of this course"),
    ],
  })

  await page.locator("text=Johdatus lokalisointiin").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin")
})

test("creator of the language version has permissions to the new version", async ({ page }) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course 'Johdatus lokalisointiin'\"] svg").click()
  await page.getByRole("tab", { name: "Permissions" }).click()
  await page.getByText("language.teacher@example.com").waitFor()
})

test("creator of new language version can grant permissions to same users as the original course", async ({
  page,
}) => {
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Introduction to localizing'" }).click()
  await page.getByRole("tab", { name: "Permissions" }).click()
  //add new permission to assistant
  await page.getByPlaceholder("Enter email").fill("assistant@example.com")
  await page.getByRole("button", { name: "Add user" }).click()
  await page.getByText("Operation successful!").waitFor()

  //make new language version
  await page.getByRole("tab", { name: "Language versions" }).click()
  await page.getByRole("button", { name: "New" }).click()
  await page.getByLabel("Name  *", { exact: true }).fill("Intro to localizing with permissions")
  await page.getByLabel("Teacher in charge name  *").fill("Teacher Example")
  await page.getByLabel("Teacher in charge email  *").fill("teacher@example.com")
  await page
    .getByLabel("Grant access to this course to everyone who had access to the original one")
    .check()
  await page.getByLabel("Swedish").check()
  await page.getByRole("button", { name: "Create" }).click()
  //go to created language version and check permissions
  await page.getByRole("link", { name: "Intro to localizing with permissions" }).click()
  await page.getByRole("tab", { name: "Permissions" }).click()
  await page.getByText("language.teacher@example.com").waitFor()
  await page.getByText("assistant@example.com").waitFor()
})
