import { Page } from "playwright"

export async function login(
  user: string,
  password: string,
  page: Page,
  stayLoggedIn?: boolean | undefined,
): Promise<void> {
  await page.goto("http://project-331.local/organizations")
  await page.waitForLoadState()

  await page.getByRole("link", { name: "Log in" }).click()
  await page.click(`label:has-text("Email")`)
  await page.fill(`label:has-text("Email")`, user)

  await page.click(`label:has-text("Password")`)
  await page.fill(`label:has-text("Password")`, password)

  const loginButton = page.locator("id=login-button")
  await loginButton.click()
  await loginButton.waitFor({ state: "hidden" })

  // Store login state
  await page.context().storageState({ path: `src/states/${user}.json` })
  if (!stayLoggedIn) {
    await page.locator("id=topbar-user-menu").click()
    await page.getByText("Log out").click()
    await page.getByRole("link", { name: "Log in" }).waitFor()
  }
}
