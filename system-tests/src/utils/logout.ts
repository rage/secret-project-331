import { chromium, expect } from "@playwright/test"
import { Page } from "playwright"

export async function logout(browser) {
  const page: Page = await browser.newPage()

  await page.goto("http://project-331.local/")
  await page.click("text=Logout")

  await browser.close()
}
