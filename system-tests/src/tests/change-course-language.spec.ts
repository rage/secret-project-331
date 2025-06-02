import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import { selectOrganization } from "../utils/organizationUtils"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Changing course language works", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Mathematics and Statistics")

  await page.getByRole("link", { name: "Navigate to course 'Introduction to citations'" }).click()
  await selectCourseInstanceIfPrompted(page)

  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "Settings", exact: true }).click()

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

  // await page.getByRole("button", { name: "Avaa valikko" }).click()
  await page.getByRole("button", { name: "Asetukset", exact: true }).click()

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
  await page.getByRole("link", { name: "Chapter 1 The Basics" }).click()
  await page.getByRole("link", { name: "2 Page 2" }).click()
  await page.getByText("First chapters second page.").click()
  await page.getByRole("button", { name: "Language" }).click()
  await page.getByRole("button", { name: "Suomi" }).click()
  await page
    .getByRole("link", {
      name: "Olet tekemässä kurssia jo toisella kielellä. Ennen kuin vastaat mihinkään tehtävään, palaa kieliversioon Introduction to citations (English) tai vaihda käytössä oleva kieli kurssin asetuksista.",
    })
    .waitFor()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-mathstat/courses/johdatus-sitaatioihin/chapter-1/page-2",
  )
})
