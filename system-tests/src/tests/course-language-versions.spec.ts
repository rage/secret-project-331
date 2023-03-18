import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/language.teacher@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.locator("[aria-label=\"Manage course 'Introduction to localizing'\"] svg").click(),
  ])
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

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.getByRole("link", { name: "Home" }).click(),
  ])

  await Promise.all([
    page.waitForNavigation(),
    page.locator("text=University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin' }*/),
    page.locator("text=Johdatus lokalisointiin").click(),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin/chapter-1' }*/),
    page.click('#content a >> :nth-match(div:has-text("CHAPTER 1The Basics"), 3)'),
  ])

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin/chapter-1/page-1' }*/),
    page.locator("text=1Page One").click(),
  ])

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-localizing/chapter-1")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "wrong-course-banner",
    waitForTheseToBeVisibleAndStable: [
      page.locator("text=Looks like you're already on a different language version"),
    ],
  })

  await page.locator("text=Johdatus lokalisointiin").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs/courses/johdatus-lokalisointiin")
})
