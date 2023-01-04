import { expect, Page, test } from "@playwright/test"

import expectUrlPathWithRandomUuid from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const replaceTimeComponentDates = async (page: Page) => {
  await page.evaluate(() => {
    const components = document.querySelectorAll(".time-component-date")
    for (const comp of Array.from(components)) {
      comp.innerHTML = "yyyy-MM-dd HH:mm"
    }
  })
}

test("can add and delete exercise service", async ({ page, headless }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")
  await page.evaluate(() => {
    window.scrollTo(0, 700)
  })

  // Click text=Manage exercise services
  await page.locator("text=Manage exercise services").click()
  await expect(page).toHaveURL("http://project-331.local/manage/exercise-services")

  await expectUrlPathWithRandomUuid(page, "/manage/exercise-services")

  // Click text=Add new service
  await page.click(`button:text("New")`)

  // Click [placeholder="Name..."]
  await page.click('[placeholder="Name..."]')

  // Fill [placeholder="Name..."]
  await page.fill('[placeholder="Name..."]', "New exercise service")

  // Click [placeholder="Public URL..."]
  await page.click('[placeholder="Public URL..."]')

  // Fill [placeholder="Public URL..."]
  await page.fill('[placeholder="Public URL..."]', "http://example.com")

  // Click [placeholder="Internal URL..."]
  await page.click('[placeholder="Internal URL..."]')

  // Click button:has-text("Create")
  await page.click('button:text("Create")')
  await page.waitForSelector("text=New exercise service")

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    snapshotName: "exercise-service-page",
    waitForTheseToBeVisibleAndStable: [page.locator("text=New exercise service")],

    beforeScreenshot: async () => {
      await replaceTimeComponentDates(page)
    },
  })
})
