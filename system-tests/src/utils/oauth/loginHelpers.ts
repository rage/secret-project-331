import { Page } from "@playwright/test"

import { ensureRedirectServer } from "./redirectServer"

import { waitForSuccessNotification } from "@/utils/notificationUtils"

async function submitConsentIfVisible(page: Page): Promise<void> {
  const consentDialog = page.getByTestId("research-consent-dialog")
  if (!(await consentDialog.isVisible())) {
    return
  }
  await page.getByLabel(/I want to participate in the educational research/).click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save" }).click()
  })
  await page.waitForURL(/\/authorize|\/oauth_authorize_scopes|\/callback/, {
    timeout: 10000,
    waitUntil: "domcontentloaded",
  })
}

/**
 * Log in on the current page (OAuth flow: we are on /login?return_to=...).
 * Does not use the global login helper. If the app shows the research consent
 * dialog after login (users without consent), we accept it so the flow continues
 * to /authorize or /oauth_authorize_scopes (same pattern as PermissionsTab / other tests).
 * If the consent dialog is already visible (e.g. from storage state), we only submit consent.
 */
export async function performLogin(page: Page, email: string, password: string) {
  await ensureRedirectServer()

  if (await page.getByTestId("research-consent-dialog").isVisible()) {
    await submitConsentIfVisible(page)
    return
  }

  const form = page
    .locator("form")
    .filter({ has: page.locator("#login-button") })
    .first()
  await form.locator("input").first().fill(email)
  await form.locator("input").nth(1).fill(password)
  await form.locator("#login-button").click()

  // After submit: either we navigate to authorize/scopes/callback, or research consent dialog appears
  await Promise.race([
    page.waitForURL(/\/authorize|\/oauth_authorize_scopes|\/callback/, {
      timeout: 10000,
      waitUntil: "domcontentloaded",
    }),
    page.getByTestId("research-consent-dialog").waitFor({ state: "visible", timeout: 10000 }),
  ])

  await submitConsentIfVisible(page)
}
