import { expect, test } from "@playwright/test"

import { resetClientAuthorization } from "../../../utils/oauth/authorizedClients"
import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import {
  APP_DISPLAY_NAME,
  STUDENT_STORAGE_STATE,
  TEST_CLIENT_ID,
  USER_EMAIL,
  USER_PASSWORD,
} from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /authorize endpoint - User Authentication State
// ============================================================================
test.describe("/authorize endpoint - User Authentication State", () => {
  test("not logged in -> redirect to /login?return_to=...", async ({ page }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url } = await oauthUrl(["openid"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)
    await page.waitForURL(/\/login\?return_to=.*/, { timeout: 10000 })
    const loginUrl = new URL(page.url())
    expect(loginUrl.pathname).toBe("/login")
    expect(loginUrl.searchParams.has("return_to")).toBe(true)
  })

  test("logged in, all scopes already granted -> issue code immediately", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      // First, grant the scopes
      const scopes = ["openid"]
      const codeVerifier1 = generateCodeVerifier()
      const codeChallenge1 = generateCodeChallenge(codeVerifier1)
      const first = await oauthUrl(scopes, {
        codeChallenge: codeChallenge1,
        codeChallengeMethod: "S256",
      })
      await page.goto(first.url)

      // Handle login if needed
      try {
        await page.waitForURL(/\/login\?return_to=.*/, { timeout: 2000 })
        await performLogin(page, USER_EMAIL, USER_PASSWORD)
      } catch {
        // Already logged in
      }

      // Wait for consent page or callback
      try {
        await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
        const consent = new ConsentPage(page, scopes)
        await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
        await consent.approve()
      } catch {
        // Consent already granted, proceed to callback
      }

      await page.waitForURL(/callback/, { timeout: 10000 })
      await assertAndExtractCodeFromCallbackUrl(page, first.state)

      // Now try again - should get code immediately without consent
      const codeVerifier2 = generateCodeVerifier()
      const codeChallenge2 = generateCodeChallenge(codeVerifier2)
      const second = await oauthUrl(scopes, {
        codeChallenge: codeChallenge2,
        codeChallengeMethod: "S256",
      })
      await page.goto(second.url)
      // Should redirect directly to callback without consent
      await page.waitForURL(/callback/, { timeout: 10000 })
      const code = await assertAndExtractCodeFromCallbackUrl(page, second.state)
      expect(code).toBeTruthy()

      // Verify consent page did not appear
      const consent2 = new ConsentPage(page, scopes)
      await consent2.expectNotPresent()
    } finally {
      await resetClientAuthorization(page)
      await ctx.close()
    }
  })

  test("logged in, missing scopes -> redirect to consent page", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      await resetClientAuthorization(page)
      const scopes = ["openid", "profile"]
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      const { url } = await oauthUrl(scopes, {
        codeChallenge,
        codeChallengeMethod: "S256",
      })
      await page.goto(url)
      // Should redirect to consent page
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 10000 })
      const consent = new ConsentPage(page, scopes)
      await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
    } finally {
      await ctx.close()
    }
  })
})
