import { expect, test } from "@playwright/test"

import { resetClientAuthorization } from "../../../utils/oauth/authorizedClients"
import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import {
  BASE,
  STUDENT_STORAGE_STATE,
  USER_EMAIL,
  USER_PASSWORD,
} from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /authorize endpoint - Authorization Code Issuance
// ============================================================================
test.describe("/authorize endpoint - Authorization Code Issuance", () => {
  test("code issued with state parameter if provided", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      await resetClientAuthorization(page)
      const state = "custom-state-123"
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      const { url, state: urlState } = await oauthUrl(["openid"], {
        codeChallenge,
        codeChallengeMethod: "S256",
      })
      // Override state
      const urlWithCustomState = url.replace(`state=${urlState}`, `state=${state}`)
      await page.goto(urlWithCustomState)
      // Handle consent if it appears
      try {
        await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
        const consent = new ConsentPage(page, ["openid"])
        await consent.approve()
      } catch {
        // Consent already granted, proceed to callback
      }
      await page.waitForURL(/callback/, { timeout: 10000 })
      const code = await assertAndExtractCodeFromCallbackUrl(page, state)
      expect(code).toBeTruthy()
    } finally {
      await ctx.close()
    }
  })

  test("code is unique (different codes for different requests)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      await resetClientAuthorization(page)
      const scopes = ["openid"]

      // First request
      const codeVerifier1 = generateCodeVerifier()
      const codeChallenge1 = generateCodeChallenge(codeVerifier1)
      const first = await oauthUrl(scopes, {
        codeChallenge: codeChallenge1,
        codeChallengeMethod: "S256",
      })
      await page.goto(first.url)

      // Handle consent if it appears
      try {
        await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
        const consent1 = new ConsentPage(page, scopes)
        await consent1.approve()
      } catch {
        // Consent already granted, proceed to callback
      }

      await page.waitForURL(/callback/, { timeout: 10000 })
      const code1 = await assertAndExtractCodeFromCallbackUrl(page, first.state)

      // Second request
      const codeVerifier2 = generateCodeVerifier()
      const codeChallenge2 = generateCodeChallenge(codeVerifier2)
      const second = await oauthUrl(scopes, {
        codeChallenge: codeChallenge2,
        codeChallengeMethod: "S256",
      })
      await page.goto(second.url)

      // Handle consent if it appears (shouldn't since scopes already granted)
      try {
        await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
        const consent2 = new ConsentPage(page, scopes)
        await consent2.approve()
      } catch {
        // Consent already granted, proceed to callback
      }

      await page.waitForURL(/callback/, { timeout: 10000 })
      const code2 = await assertAndExtractCodeFromCallbackUrl(page, second.state)

      expect(code1).not.toBe(code2)
    } finally {
      await ctx.close()
    }
  })

  test("PKCE parameters preserved through login redirect", async ({ page }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url } = await oauthUrl(["openid"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)
    await page.waitForURL(/\/login\?return_to=.*/, { timeout: 10000 })

    // Verify return_to includes PKCE parameters
    const loginUrl = new URL(page.url())
    const returnTo = loginUrl.searchParams.get("return_to")
    expect(returnTo).toBeTruthy()
    const returnToUrl = new URL(returnTo!, BASE)
    expect(returnToUrl.searchParams.get("code_challenge")).toBe(codeChallenge)
    expect(returnToUrl.searchParams.get("code_challenge_method")).toBe("S256")

    // Complete login
    await performLogin(page, USER_EMAIL, USER_PASSWORD)
    // After login, PKCE parameters should be preserved in the authorize URL
    // (They'll be in the URL if we go to consent, or in the code if scopes are already granted)
    // Wait for navigation to one of the expected routes
    await page.waitForURL(/(\/authorize|\/oauth_authorize_scopes|\/callback)/, { timeout: 10000 })
    const afterLoginUrl = page.url()
    // Should either be on consent page (with PKCE params in URL) or callback (PKCE stored in code)
    expect(
      afterLoginUrl.includes("/oauth_authorize_scopes") ||
        afterLoginUrl.includes("/callback") ||
        afterLoginUrl.includes("/authorize"),
    ).toBe(true)

    // If on consent page, verify PKCE params are in URL
    if (afterLoginUrl.includes("/oauth_authorize_scopes")) {
      const consentUrl = new URL(afterLoginUrl)
      expect(consentUrl.searchParams.get("code_challenge")).toBe(codeChallenge)
      expect(consentUrl.searchParams.get("code_challenge_method")).toBe("S256")
    }
  })

  test("PKCE parameters preserved through consent redirect", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      await resetClientAuthorization(page)
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      const { url, state } = await oauthUrl(["openid"], {
        codeChallenge,
        codeChallengeMethod: "S256",
      })
      await page.goto(url)
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 10000 })

      // Verify consent page URL has PKCE parameters
      const consentUrl = new URL(page.url())
      expect(consentUrl.searchParams.get("code_challenge")).toBe(codeChallenge)
      expect(consentUrl.searchParams.get("code_challenge_method")).toBe("S256")

      // Approve consent
      const consent = new ConsentPage(page, ["openid"])
      await consent.approve()
      // After approval, code should be issued and PKCE should be preserved in DB
      const code = await assertAndExtractCodeFromCallbackUrl(page, state)
      expect(code).toBeTruthy()

      // Verify we can exchange the code with the verifier (proves PKCE was preserved)
      const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
      expect(tok.access_token).toBeTruthy()
    } finally {
      await ctx.close()
    }
  })
})
