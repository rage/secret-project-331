import { expect } from "@playwright/test"
import { Page } from "playwright"

export async function login(
  user: string,
  password: string,
  page?: Page | undefined,
  stayLoggedIn?: boolean | undefined,
): Promise<void> {
  await page.goto("http://project-331.local/")
  await page.click('[aria-label="Navigation menu"]')

  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/login?return_to=%2F' }*/),
    page.click("text=Log in"),
  ])

  await page.click('input[name="email"]')
  await page.fill('input[name="email"]', user)

  await page.click('input[name="password"]')
  await page.fill('input[name="password"]', password)

  await Promise.all([
    page.waitForNavigation(/*{ url: "http://project-331.local/" }*/),
    page.click("text=Submit"),
  ])

  // Ensure we are logged in
  const afterLogin = await page.content()
  expect(afterLogin).toContain("Log out")
  expect(afterLogin).not.toContain("Log in")

  // Store login state
  await page.context().storageState({ path: `src/states/${user}.json` })
  if (!stayLoggedIn) {
    await page.click('[aria-label="Navigation menu"]')
    await page.click("text=Log out")
    await page.waitForSelector("text=Log in")
  }
}
