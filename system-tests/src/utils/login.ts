import { Page } from "playwright"

export async function login(
  user: string,
  password: string,
  page: Page,
  stayLoggedIn?: boolean | undefined,
): Promise<void> {
  await page.goto("http://project-331.local/")
  await page.click("id=main-navigation-menu")

  await page.click("text=Log in")
  await page.click(`label:has-text("Email")`)
  await page.fill(`label:has-text("Email")`, user)

  await page.click(`label:has-text("Password")`)
  await page.fill(`label:has-text("Password")`, password)

  await page.click("id=login-button")

  await page.locator(`text=Log out`).first().waitFor({ state: "attached" })
  await page.locator(`text=Log in`).first().waitFor({ state: "detached" })

  // Store login state
  await page.context().storageState({ path: `src/states/${user}.json` })
  if (!stayLoggedIn) {
    await page.click("id=main-navigation-menu")
    await page.click("text=Log out")
    await page.waitForSelector("text=Log in")
  }
}
