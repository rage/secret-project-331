import { chromium, expect } from "@playwright/test"
import { Page } from "playwright"

export async function login(
  user: string,
  password: string,
  page?: Page | undefined,
): Promise<void> {
  let loginPage = page
  if (!page) {
    const browser = await chromium.launch()
    loginPage = await browser.newPage()
  }

  await loginPage.goto("http://project-331.local/")

  await Promise.all([
    loginPage.waitForNavigation(/*{ url: 'http://project-331.local/login?return_to=%2F' }*/),
    loginPage.click("text=Login"),
  ])

  await loginPage.click('input[name="email"]')
  await loginPage.fill('input[name="email"]', user)

  await loginPage.click('input[name="password"]')
  await loginPage.fill('input[name="password"]', password)

  await Promise.all([
    loginPage.waitForNavigation(/*{ url: "http://project-331.local/" }*/),
    loginPage.click("button[name=login]"),
  ])

  // Ensure we are logged in
  const afterLogin = await loginPage.content()
  expect(afterLogin).toContain("Logout")
  expect(afterLogin).not.toContain("Login")

  // Store login state
  await loginPage.context().storageState({ path: `src/states/${user}.json` })
}
