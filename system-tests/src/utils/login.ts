import { Page } from "playwright"

export async function login(
  user: string,
  password: string,
  page: Page,
  stayLoggedIn?: boolean | undefined,
): Promise<void> {
  await page.goto("http://project-331.local/")
  await page.locator("id=main-navigation-menu").click()

  await page.locator("text=Log in").click()
  await page.click(`label:has-text("Email")`)
  await page.fill(`label:has-text("Email")`, user)

  await page.click(`label:has-text("Password")`)
  await page.fill(`label:has-text("Password")`, password)

  await page.locator("id=login-button").click()

  await page.locator(`text=Log out`).first().waitFor({ state: "attached" })
  await page.locator(`text=Log in`).first().waitFor({ state: "detached" })

  // Store login state
  await page.context().storageState({ path: `src/states/${user}.json` })
  if (!stayLoggedIn) {
    await page.locator("id=main-navigation-menu").click()
    await page.locator("text=Log out").click()
    await page.waitForSelector("text=Log in")
  }
}
