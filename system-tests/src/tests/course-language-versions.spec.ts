import { expect, test } from "@playwright/test"

import { createCourseLanguageVersion } from "@/utils/flows/newCourse.flow"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

import { ChapterSelector } from "../utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/language.teacher@example.com.json",
})

test("Creating a new language version works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course 'Introduction to localizing'\"] svg").click()
  await expect(page).toHaveURL(
    "http://project-331.local/manage/courses/639f4d25-9376-49b5-bcca-7cba18c38565",
  )

  await page.getByRole("tab", { name: "Language versions" }).click()

  await createCourseLanguageVersion(page, "Introduction to localizing", {
    name: "Johdatus lokalisointiin",
    language: "Finnish",
    teacherInChargeName: "teacher",
    teacherInChargeEmail: "teacher@example.com",
    description: "Course description",
  })
  await page.getByText("Course created successfully").waitFor()

  await page.goto("http://project-331.local/org/uh-cs")

  await page.getByText("Johdatus lokalisointiin").click()

  await selectCourseInstanceIfPrompted(page)

  const chapterSelector = new ChapterSelector(page)
  await chapterSelector.clickChapter(1)

  await page.getByText("1Page One").click()

  await page.getByText(`Like this.`).first().waitFor()

  await page.goto("about:blank")
  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-localizing/")
  await chapterSelector.clickChapter(1)
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-localizing/chapter-1",
  )

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "wrong-course-banner",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("You have previously started this course in a different language").first(),
    ],
  })

  await page.getByText("Johdatus lokalisointiin").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin/chapter-1",
  )
})

test("creator of the language version has permissions to the new version", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.locator("[aria-label=\"Manage course 'Johdatus lokalisointiin'\"] svg").click()
  await page.getByRole("tab", { name: "Permissions" }).click()
  await page.getByText("language.teacher@example.com").waitFor()
})

test("creator of new language version can grant permissions to same users as the original course", async ({
  page,
}) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.getByRole("link", { name: "Manage course 'Introduction to localizing'" }).click()
  await page.getByRole("tab", { name: "Permissions" }).click()
  //add new permission to assistant
  await page.getByPlaceholder("Enter email").fill("assistant@example.com")
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Add user" }).click()
  })

  //make new language version
  await page.getByRole("tab", { name: "Language versions" }).click()
  await createCourseLanguageVersion(page, "Introduction to localizing", {
    name: "Intro to localizing with permissions",
    language: "Swedish",
    teacherInChargeName: "Teacher Example",
    teacherInChargeEmail: "teacher@example.com",
    grantAccessToOriginalUsers: true,
  })
  //go to created language version and check permissions
  await page.getByRole("link", { name: "Intro to localizing with permissions" }).click()
  await page.getByRole("tab", { name: "Permissions" }).click()
  await page.getByText("language.teacher@example.com").waitFor()
  await page.getByText("assistant@example.com").waitFor()
})
