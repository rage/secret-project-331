import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Mathematics and Statistics" })
    .click()
  await page.getByRole("link", { name: "Navigate to course 'Introduction to citations'" }).click()
  await page.getByText("Default").first().check()
  await page.getByRole("button", { name: "Continue" }).click()

  await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "Settings" }).click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "course-lang-selection-eng-to-fi",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Choose your preferred language")],
  })
  const value = page.locator("#changeLanguage")
  value?.selectOption([{ label: "Suomi" }, { value: "af01f8cd-d40c-42af-a4e1-3dc9573765ce,fi-FI" }])

  await page.getByText("Default").first().click()
  await page.getByRole("button", { name: "Continue" }).click()

  await page.getByRole("heading", { name: "Kurssin yhteenveto" }).click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-mathstat/courses/johdatus-sitaatioihin",
  )

  await page.getByRole("button", { name: "Avaa valikko" }).click()
  await page.getByRole("button", { name: "Asetukset" }).click()

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "course-lang-selection-fi-to-eng",
    waitForTheseToBeVisibleAndStable: [page.locator("text=Valitse kieli")],
  })

  const value1 = page.locator("#changeLanguage")
  value1?.selectOption([
    { label: "English" },
    { value: "049061ba-ac30-49f1-aa9d-b7566dc22b78,en-US" },
  ])

  await page.getByText("Oletus").first().click()
  await page.getByRole("button", { name: "Jatka" }).click()
  await page.getByRole("heading", { name: "Course overview" }).click()

  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-mathstat/courses/introduction-to-citations",
  )
})
