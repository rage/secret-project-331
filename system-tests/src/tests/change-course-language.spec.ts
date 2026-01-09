import { expect, test } from "@playwright/test"

import { ChapterSelector } from "../utils/components/ChapterSelector"
import { Topbar } from "../utils/components/Topbar"
import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import { openCourseSettingsFromQuickActions } from "../utils/flows/topbar.flow"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Changing course language works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Mathematics and Statistics")

  await page.getByRole("link", { name: "Navigate to course 'Introduction to citations'" }).click()
  await selectCourseInstanceIfPrompted(page)

  await openCourseSettingsFromQuickActions(page)

  await page.getByText("Choose your preferred language").first().waitFor()
  await page.getByRole("heading", { name: "Course settings" }).click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "course-lang-selection-eng-to-fi",
  })
  const value = page.locator("#changeLanguage")
  await value?.selectOption({ label: "Suomi" })
  await page.getByText("Valitse kieli").first().waitFor()

  await page.getByText("Oletus").first().click()
  await page.getByRole("button", { name: "Jatka" }).click()
  await page.getByRole("heading", { name: "Kurssin asetukset" }).waitFor({ state: "hidden" })

  await page.getByRole("heading", { name: "Kurssin yhteenveto" }).waitFor()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-mathstat/courses/johdatus-sitaatioihin",
  )

  await openCourseSettingsFromQuickActions(page, "Asetukset")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "course-lang-selection-fi-to-eng",
    waitForTheseToBeVisibleAndStable: [
      page.getByText("Valitse kieli"),
      page.locator("id=language-flag"),
    ],
  })

  const value1 = page.locator("#changeLanguage")
  await value1?.selectOption({ label: "English" })
  await page.getByText("Choose your preferred language").first().waitFor()
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(200)
  await page.getByText("Default").first().click()
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(200)
  await page.getByTestId("select-course-instance-continue-button").click()
  try {
    await page.getByTestId("select-course-instance-continue-button").waitFor({ state: "hidden" })
  } catch (_e) {
    await page.getByTestId("select-course-instance-continue-button").click()
    await page.getByTestId("select-course-instance-continue-button").waitFor({ state: "hidden" })
  }

  await page.getByRole("heading", { name: "Course overview" }).waitFor()

  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-mathstat/courses/introduction-to-citations",
  )
  // Make sure the language menu changes the course language version
  const chapterSelector = new ChapterSelector(page)
  await chapterSelector.clickChapter(1)
  await page.getByRole("link", { name: "2 Page 2" }).click()
  await page.getByText("First chapters second page.").click()
  const topbar = new Topbar(page)
  await topbar.languageMenu.clickItem("Suomi")
  await page.getByText("Olet aiemmin aloittanut tämän kurssin eri kielellä.").first().waitFor()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-mathstat/courses/johdatus-sitaatioihin/chapter-1/page-2",
  )
})
