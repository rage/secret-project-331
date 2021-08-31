import { test } from "@playwright/test"

import expectPath from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("can add and delete exercise service", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=Manage exercise services
  await Promise.all([page.waitForNavigation(), page.click("text=Manage exercise services")])

  expectPath(page, "/manage/exercise-services")

  // Click text=Example ExerciseSlug: example-exercisePublic URL: http://project-331.local/examp >> button
  await page.click(
    "text=Example ExerciseSlug: example-exercisePublic URL: http://project-331.local/examp >> button",
  )
  // Click button:has-text("Delete")
  await page.click('button:has-text("Delete")')

  // Click text=QuizzesSlug: quizzesPublic URL: http://project-331.local/quizzes/api/service-inf >> button
  await page.click(
    "text=QuizzesSlug: quizzesPublic URL: http://project-331.local/quizzes/api/service-inf >> button",
  )

  // Click button:has-text("Delete")
  await page.click('button:has-text("Delete")')

  // Click text=Add new service
  await page.click("text=Add new service")

  // Click [placeholder="Name..."]
  await page.click('[placeholder="Name..."]')

  // Fill [placeholder="Name..."]
  await page.fill('[placeholder="Name..."]', "New exercise service")

  // Click [placeholder="Public URL..."]
  await page.click('[placeholder="Public URL..."]')

  // Fill [placeholder="Public URL..."]
  await page.fill('[placeholder="Public URL..."]', "http://public_url")

  // Click [placeholder="Internal URL..."]
  await page.click('[placeholder="Internal URL..."]')

  // Fill [placeholder="Internal URL..."]
  await page.fill('[placeholder="Internal URL..."]', "http://internal_url")

  // Click button:has-text("Create")
  await page.click('button:has-text("Create")')
  await page.waitForSelector("text=New exercise service")

  await expectScreenshotsToMatchSnapshots(
    page,
    headless,
    "exercise-service-page",
    "text=New exercise service",
  )
})
