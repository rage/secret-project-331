import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("can add and delete exercise service", async ({ page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=Manage exercise services
  await page.click("text=Manage exercise services")
  expect(page.url()).toBe("http://project-331.local/manage/exercise-services")

  // Click text=Add new service
  await page.click("text=Add new service")

  // Click [placeholder="Name..."]
  await page.click('[placeholder="Name..."]')

  // Fill [placeholder="Name..."]
  await page.fill('[placeholder="Name..."]', "example service")

  // Click [placeholder="Public URL..."]
  await page.click('[placeholder="Public URL..."]')

  // Fill [placeholder="Public URL..."]
  await page.fill('[placeholder="Public URL..."]', "http://public.url")

  // Click [placeholder="Internal URL..."]
  await page.click('[placeholder="Internal URL..."]')

  // Fill [placeholder="Internal URL..."]
  await page.fill('[placeholder="Internal URL..."]', "http://internal_url")

  // Click button:has-text("Create")
  await page.click('button:has-text("Create")')

  // Click text=example serviceSlug: example-servicePublic URL: http://public.url Internal URL:  >> button
  await page.click(
    "text=example serviceSlug: example-servicePublic URL: http://public.url Internal URL:  >> button",
  )

  // Click button:has-text("Delete")
  await page.click('button:has-text("Delete")')
})
