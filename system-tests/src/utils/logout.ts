import { Page } from "playwright"

export async function logout(page: Page): Promise<void> {
  await page.goto("http://project-331.local/organizations")
  await page.locator("id=topbar-user-menu").click()
  await page.getByText("Log out").click()
}
