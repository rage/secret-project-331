import { Page } from "@playwright/test"

export async function performLogin(page: Page, email: string, password: string) {
  // Scope to the actual login <form> via the submit button id
  const form = page
    .locator("form")
    .filter({ has: page.locator("#login-button") })
    .first()
  await form.locator("input").first().fill(email)
  await form.locator("input").nth(1).fill(password)

  // In OAuth flow, after login we get redirected back to /authorize via return_to
  // Wait for navigation away from the login page
  await Promise.all([
    page.waitForURL(/\/authorize|\/oauth_authorize_scopes|\/callback/, { timeout: 10000 }),
    form.locator("#login-button").click(),
  ])
}
