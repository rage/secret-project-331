import { BrowserContext, expect, Page, test } from "@playwright/test"

import { resetClientAuthorization } from "../../utils/oauth/authorizedClients"
import { assertAndExtractCodeFromCallbackUrl } from "../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../utils/oauth/consentPage"
import {
  APP_DISPLAY_NAME,
  STUDENT_STORAGE_STATE,
  TEST_CLIENT_ID,
  USER_EMAIL,
  USER_EMAIL_2,
  USER_PASSWORD,
  USER_PASSWORD_2,
} from "../../utils/oauth/constants"
import { createDPoPKey } from "../../utils/oauth/dpop"
import { performLogin } from "../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../utils/oauth/pkce"
import { callUserInfo, exchangeCodeForToken } from "../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../utils/oauth/urlHelpers"

// ============================================================================
// OAuth flow (login during flow)
// ============================================================================
test.describe("OAuth flow (login during flow)", () => {
  test("DPoP: prompts for scopes, logs in, approves, exchanges code, and hits userinfo", async ({
    page,
  }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state, scopes } = await oauthUrl(["openid", "email"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })

    // Start at /authorize -> expect to hit /login?return_to
    await page.goto(url)
    await page.waitForURL(/\/login\?return_to=.*/)

    // Login
    await performLogin(page, USER_EMAIL, USER_PASSWORD)

    // Consent page
    const consent = new ConsentPage(page, scopes)
    const nameMatcher = new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`)
    await consent.expectVisible(nameMatcher)

    // Approve, assert callback, and extract the auth code
    await consent.approve()
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)

    // --- DPoP flow ---
    const key = await createDPoPKey()
    const tok = await exchangeCodeForToken(code, { kind: "dpop", key }, codeVerifier)
    const userinfo = await callUserInfo(tok.access_token, { kind: "dpop", key })

    expect(userinfo.sub).toBeTruthy()
    expect(String(userinfo.email)).toMatch(/student1@example\.com$/i)
  })

  test("Bearer: prompts for scopes, logs in, approves, exchanges code, and hits userinfo", async ({
    page,
  }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state, scopes } = await oauthUrl(["openid", "email"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })

    await page.goto(url)
    await page.waitForURL(/\/login\?return_to=.*/)

    await performLogin(page, USER_EMAIL_2, USER_PASSWORD_2)

    const consent = new ConsentPage(page, scopes)
    const nameMatcher = new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`)
    await consent.expectVisible(nameMatcher)

    await consent.approve()
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)

    // --- Bearer flow ---
    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    const userinfo = await callUserInfo(tok.access_token, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
  })
})

// ============================================================================
// OAuth flow (already logged in via storage state)
// ============================================================================
test.describe("OAuth flow (already logged in via storage state)", () => {
  let ctx: BrowserContext
  let page: Page

  test.beforeEach(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    page = await ctx.newPage()
    // Ensure there is NO pre-existing grant for our client
    await resetClientAuthorization(page)
  })

  test.afterEach(async () => {
    await ctx.close()
  })

  test("prompts on first run, then skips consent when scopes already granted (no token exchange here)", async () => {
    const scopes = ["openid", "profile"]

    // 1) First grant: consent + approve
    const codeVerifier1 = generateCodeVerifier()
    const codeChallenge1 = generateCodeChallenge(codeVerifier1)
    const first = await oauthUrl(scopes, {
      codeChallenge: codeChallenge1,
      codeChallengeMethod: "S256",
    })
    await page.goto(first.url)
    const consent = new ConsentPage(page, scopes)
    await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
    await consent.approve()
    await assertAndExtractCodeFromCallbackUrl(page, first.state)

    // 2) Same scopes again: immediate redirect to callback (no consent dialog)
    const codeVerifier2 = generateCodeVerifier()
    const codeChallenge2 = generateCodeChallenge(codeVerifier2)
    const second = await oauthUrl(scopes, {
      codeChallenge: codeChallenge2,
      codeChallengeMethod: "S256",
    })
    await page.goto(second.url)
    await assertAndExtractCodeFromCallbackUrl(page, second.state)
    await consent.expectNotPresent()
  })

  test("revoking application authorization causes consent to reappear next time", async () => {
    // Ensure a grant exists
    const scopes = ["openid"]
    const codeVerifier1 = generateCodeVerifier()
    const codeChallenge1 = generateCodeChallenge(codeVerifier1)
    const initial = await oauthUrl(scopes, {
      codeChallenge: codeChallenge1,
      codeChallengeMethod: "S256",
    })
    await page.goto(initial.url)
    const consent = new ConsentPage(page, scopes)
    await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
    await consent.approve()
    await assertAndExtractCodeFromCallbackUrl(page, initial.state)

    // Revoke in settings
    await resetClientAuthorization(page)

    // Visit authorize again — consent should appear (grant removed)
    const codeVerifier2 = generateCodeVerifier()
    const codeChallenge2 = generateCodeChallenge(codeVerifier2)
    const again = await oauthUrl(scopes, {
      codeChallenge: codeChallenge2,
      codeChallengeMethod: "S256",
    })
    await page.goto(again.url)
    const consent2 = new ConsentPage(page, scopes)
    await consent2.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
  })
})
