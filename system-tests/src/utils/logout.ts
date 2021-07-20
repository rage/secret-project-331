import { Page } from "playwright"

export async function logout(page: Page) {
  await page.goto("http://project-331.local/")
  await page.click("button[name=logout]")
}
