import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/language.teacher@example.com.json",
})

test("test", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Introduction to localizing Manage >> :nth-match(a, 2)
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=Introduction to localizing Manage >> :nth-match(a, 2)"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/manage/courses/639f4d25-9376-49b5-bcca-7cba18c38565",
  )

  // Click text=New language version
  await page.click(`:nth-match(button:below(:text("All course language versions")):text("New"), 1)`)

  // Click input[type="text"]
  await page.click('input[type="text"]')

  // Fill input[type="text"]
  await page.fill('input[type="text"]', "Johdatus lokalisointiin")

  // Click :nth-match(input[name="mui-913296558"], 2)
  await page.click(':nth-match(input[type="radio"], 2)')

  await page.fill('input[id="teacher-in-charge-name"]', "teacher")
  await page.fill('input[id="teacher-in-charge-email"]', "teacher@example.com")

  // Click text=Create course
  await page.click(`button:text("Create")`)

  // Click [aria-label="Kotisivulle"]
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/' }*/),
    page.click('[aria-label="Home page"]'),
  ])

  // Click [id="__next"] div >> :nth-match(div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer "), 4)
  await Promise.all([
    page.waitForNavigation(),
    page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe(
    "http://project-331.local/organizations/8bb12295-53ac-4099-9644-ac0ff5e34d92",
  )

  // Click text=Johdatus lokalisointiin
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/johdatus-lokalisointiin' }*/),
    page.click("text=Johdatus lokalisointiin"),
  ])

  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  // Click #content a >> :nth-match(div:has-text("CHAPTER 1The Basics"), 3)
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/johdatus-lokalisointiin/chapter-1' }*/),
    page.click('#content a >> :nth-match(div:has-text("CHAPTER 1The Basics"), 3)'),
  ])

  // Click text=1Page One
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/courses/johdatus-lokalisointiin/chapter-1/page-1' }*/),
    page.click("text=1Page One"),
  ])

  // Go to http://project-331.local/courses/introduction-to-localizing/chapter-1/page-1
  await page.goto("http://project-331.local/courses/introduction-to-localizing/chapter-1")

  await expectScreenshotsToMatchSnapshots({
    axeSkip: true, // not for new screenshots
    page,
    headless,
    snapshotName: "wrong-course-banner",
    waitForThisToBeVisibleAndStable: [
      "text=Looks like you're already on a different language version",
    ],
  })

  // Click text=Johdatus lokalisointiin
  await page.click("text=Johdatus lokalisointiin")
  expect(page.url()).toBe("http://project-331.local/courses/johdatus-lokalisointiin")
})
