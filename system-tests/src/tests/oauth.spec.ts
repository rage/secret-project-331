import { BrowserContext, expect, Page, test } from "@playwright/test"

// Import utilities
import { resetClientAuthorization } from "../utils/oauth/authorizedClients"
import { assertAndExtractCodeFromCallbackUrl } from "../utils/oauth/callbackHelpers"
import { ConsentPage } from "../utils/oauth/consentPage"
import {
  APP_DISPLAY_NAME,
  AUTHORIZE,
  BASE,
  JWKS_URI,
  REVOKE,
  STUDENT_STORAGE_STATE,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TOKEN,
  USER_EMAIL,
  USER_EMAIL_2,
  USER_PASSWORD,
  USER_PASSWORD_2,
  USERINFO,
  WELL_KNOWN,
} from "../utils/oauth/constants"
import { createDPoPKey } from "../utils/oauth/dpop"
import { performLogin } from "../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../utils/oauth/pkce"
import { setupRedirectServer, teardownRedirectServer } from "../utils/oauth/redirectServer"
import { revokeToken } from "../utils/oauth/revokeHelpers"
import { callUserInfo, exchangeCodeForToken } from "../utils/oauth/tokenHelpers"
import { oauthUrl } from "../utils/oauth/urlHelpers"

// Setup redirect server
test.beforeAll(async () => {
  await setupRedirectServer()
})

test.afterAll(async () => {
  await teardownRedirectServer()
})

// ============================================================================
// SUITE 0: OIDC Discovery and JWKS
// ============================================================================
test.describe("OIDC discovery and JWKS", () => {
  test("well-known configuration exposes expected fields and values", async () => {
    const resp = await fetch(WELL_KNOWN, { method: "GET", headers: { Accept: "application/json" } })
    expect(resp.status).toBe(200)
    const cfg = await resp.json()

    // Required endpoints/fields
    expect(cfg.issuer).toBe(`${BASE}/api/v0/main-frontend/oauth`)
    expect(cfg.authorization_endpoint).toBe(AUTHORIZE)
    expect(cfg.token_endpoint).toBe(TOKEN)
    expect(cfg.userinfo_endpoint).toBe(USERINFO)
    expect(cfg.revocation_endpoint).toBe(REVOKE)
    expect(cfg.jwks_uri).toBe(JWKS_URI)

    // Capabilities
    expect(cfg.response_types_supported).toContain("code")
    expect(cfg.subject_types_supported).toContain("public")
    expect(cfg.id_token_signing_alg_values_supported).toContain("RS256")
    // You advertise DPoP algs too
    expect(cfg.dpop_signing_alg_values_supported).toStrictEqual(
      expect.arrayContaining(["ES256", "RS256"]),
    )
    expect(cfg.token_endpoint_auth_methods_supported).toStrictEqual(
      expect.arrayContaining(["client_secret_post"]),
    )
  })

  // ---------- Small utils ----------
  const b64urlRe = /^[A-Za-z0-9_-]+$/
  const isB64Url = (s: unknown) => typeof s === "string" && s.length > 0 && b64urlRe.test(s)

  test("jwks returns at least one RS256 signing key with valid n/e/kid", async () => {
    const resp = await fetch(JWKS_URI, { method: "GET", headers: { Accept: "application/json" } })
    expect(resp.status).toBe(200)
    const jwks = await resp.json()

    expect(Array.isArray(jwks.keys)).toBe(true)
    expect(jwks.keys.length).toBeGreaterThanOrEqual(1)

    const k = jwks.keys[0]
    // Shape & values
    expect(k.kty).toBe("RSA")
    expect(k.use || "sig").toBe("sig")
    expect(k.alg).toBe("RS256")
    expect(typeof k.kid).toBe("string")
    expect(k.kid.length).toBeGreaterThan(0)

    // Base64url parameters
    expect(isB64Url(k.n)).toBe(true)
    expect(isB64Url(k.e)).toBe(true)

    // Optionally: fetch the well-known and ensure its jwks_uri matches what we hit
    const cfg = await (await fetch(WELL_KNOWN)).json()
    expect(cfg.jwks_uri).toBe(JWKS_URI)
  })
})

// ============================================================================
// SUITE 1: Not logged in — login happens inside OAuth flow (deterministic)
// ============================================================================
test.describe("OAuth flow (login during flow)", () => {
  test("DPoP: prompts for scopes, logs in, approves, exchanges code, and hits userinfo", async ({
    page,
  }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state, scopes } = oauthUrl(["openid", "email"], {
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
    const { url, state, scopes } = oauthUrl(["openid", "email"], {
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

// ==========================================================================================
// SUITE 2: Already logged in (storage state) — first shows consent, second skips; revoke shows again
// ==========================================================================================
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
    const first = oauthUrl(scopes, {
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
    const second = oauthUrl(scopes, {
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
    const initial = oauthUrl(scopes, {
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
    const again = oauthUrl(scopes, {
      codeChallenge: codeChallenge2,
      codeChallengeMethod: "S256",
    })
    await page.goto(again.url)
    const consent2 = new ConsentPage(page, scopes)
    await consent2.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
  })
})

// ============================================================================
// SUITE 3: Token Revocation (RFC 7009)
// ============================================================================
test.describe("Token Revocation (RFC 7009)", () => {
  // Helper to get a valid access token using PKCE
  async function getAccessToken(page: Page): Promise<string> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state, scopes } = oauthUrl(["openid", "email"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)

    // Handle login - user might already be logged in
    try {
      await page.waitForURL(/\/login\?return_to=.*/, { timeout: 2000 })
      // User needs to login
      await performLogin(page, USER_EMAIL, USER_PASSWORD)
    } catch {
      // User is already logged in, skip login page
      // We might already be on consent page or callback, so continue
    }

    // Handle both cases: consent page may appear or may be skipped if already granted
    // Wait for navigation after login - we'll either go to consent page or directly to callback
    try {
      // Try to wait for consent page first (with short timeout)
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
      // If we get here, we're on consent page
      const consent = new ConsentPage(page, scopes)
      await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
      await consent.approve()
    } catch {
      // Consent page didn't appear (already granted), wait for callback instead
      await page.waitForURL(/callback/, { timeout: 10000 })
    }

    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    return tok.access_token
  }

  // Helper to get a valid refresh token using PKCE
  async function getRefreshToken(page: Page): Promise<string> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state, scopes } = oauthUrl(["openid", "offline_access"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)

    // Handle login - user might already be logged in
    try {
      await page.waitForURL(/\/login\?return_to=.*/, { timeout: 2000 })
      // User needs to login
      await performLogin(page, USER_EMAIL, USER_PASSWORD)
    } catch {
      // User is already logged in, skip login page
      // We might already be on consent page or callback, so continue
    }

    // Handle both cases: consent page may appear or may be skipped if already granted
    // Wait for navigation after login - we'll either go to consent page or directly to callback
    try {
      // Try to wait for consent page first (with short timeout)
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
      // If we get here, we're on consent page
      const consent = new ConsentPage(page, scopes)
      await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
      await consent.approve()
    } catch {
      // Consent page didn't appear (already granted), wait for callback instead
      await page.waitForURL(/callback/, { timeout: 10000 })
    }

    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    if (!tok.refresh_token) {
      throw new Error("Expected refresh_token but got none")
    }
    return tok.refresh_token
  }

  // ========== Success Cases ==========
  test("revokes access token successfully", async ({ page }) => {
    const accessToken = await getAccessToken(page)

    // Revoke the token
    const response = await revokeToken({ token: accessToken })
    expect(response.status).toBe(200)

    // Verify token is revoked (attempt to use it fails)
    const userinfoResp = await fetch(USERINFO, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    expect(userinfoResp.status).toBeGreaterThanOrEqual(400)
  })

  test("revokes refresh token successfully", async ({ page }) => {
    const refreshToken = await getRefreshToken(page)

    // Revoke the refresh token
    const response = await revokeToken({ token: refreshToken })
    expect(response.status).toBe(200)

    // Verify refresh token is revoked (attempt to refresh fails)
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    const refreshResp = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(refreshResp.status).toBeGreaterThanOrEqual(400)
  })

  test("revokes access token with token_type_hint", async ({ page }) => {
    const accessToken = await getAccessToken(page)

    const response = await revokeToken({
      token: accessToken,
      token_type_hint: "access_token",
    })
    expect(response.status).toBe(200)

    // Verify token is revoked
    const userinfoResp = await fetch(USERINFO, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    expect(userinfoResp.status).toBeGreaterThanOrEqual(400)
  })

  test("revokes refresh token with token_type_hint", async ({ page }) => {
    const refreshToken = await getRefreshToken(page)

    const response = await revokeToken({
      token: refreshToken,
      token_type_hint: "refresh_token",
    })
    expect(response.status).toBe(200)

    // Verify refresh token is revoked
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    const refreshResp = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(refreshResp.status).toBeGreaterThanOrEqual(400)
  })

  test("revokes token without token_type_hint (tries access first)", async ({ page }) => {
    const accessToken = await getAccessToken(page)

    // Revoke without hint - should try access token first
    const response = await revokeToken({ token: accessToken })
    expect(response.status).toBe(200)

    // Verify token is revoked
    const userinfoResp = await fetch(USERINFO, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    expect(userinfoResp.status).toBeGreaterThanOrEqual(400)
  })

  // ========== Client Authentication Edge Cases ==========
  test("returns 200 OK for invalid client_id (prevents enumeration)", async () => {
    const response = await revokeToken({
      token: "some-random-token",
      client_id: "invalid-client-id",
    })
    // RFC 7009 requires 200 OK even for invalid clients to prevent enumeration
    expect(response.status).toBe(200)
  })

  test("returns 200 OK for invalid client_secret (prevents enumeration)", async () => {
    const response = await revokeToken({
      token: "some-random-token",
      client_secret: "invalid-secret",
    })
    // RFC 7009 requires 200 OK even for invalid secrets to prevent enumeration
    expect(response.status).toBe(200)
  })

  // ========== Token Validation Edge Cases ==========
  test("returns 200 OK for invalid token (prevents enumeration)", async () => {
    const response = await revokeToken({ token: "invalid-token-that-does-not-exist" })
    // RFC 7009 requires 200 OK even for invalid tokens to prevent enumeration
    expect(response.status).toBe(200)
  })

  test("returns 200 OK for already revoked token", async ({ page }) => {
    const accessToken = await getAccessToken(page)

    // Revoke once
    const response1 = await revokeToken({ token: accessToken })
    expect(response1.status).toBe(200)

    // Try to revoke again
    const response2 = await revokeToken({ token: accessToken })
    // RFC 7009 requires 200 OK even if already revoked
    expect(response2.status).toBe(200)
  })

  // ========== Request Validation Edge Cases ==========
  test("rejects missing token parameter", async () => {
    const body = new URLSearchParams({
      client_id: TEST_CLIENT_ID,
    })
    const response = await fetch(REVOKE, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    // Should return error for missing required parameter
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  test("rejects missing client_id parameter", async () => {
    const body = new URLSearchParams({
      token: "some-token",
    })
    const response = await fetch(REVOKE, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    // Should return error for missing required parameter
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  test("rejects invalid token_type_hint", async () => {
    const body = new URLSearchParams({
      token: "some-token",
      client_id: TEST_CLIENT_ID,
      token_type_hint: "invalid_hint_value",
    })
    const response = await fetch(REVOKE, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    // Should return error for invalid token_type_hint
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  test("ignores unknown parameters (RFC 7009 §2.1)", async ({ page }) => {
    const accessToken = await getAccessToken(page)

    // Include unknown parameter (and required client_secret for confidential client)
    const body = new URLSearchParams({
      token: accessToken,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      unknown_param: "should-be-ignored",
    })
    const response = await fetch(REVOKE, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    // Should still process correctly
    expect(response.status).toBe(200)

    // Verify token was actually revoked
    const userinfoResp = await fetch(USERINFO, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    expect(userinfoResp.status).toBeGreaterThanOrEqual(400)
  })

  // ========== Integration Tests ==========
  test("revoked access token cannot be used for userinfo", async ({ page }) => {
    const accessToken = await getAccessToken(page)

    // Verify token works initially
    const userinfo1 = await callUserInfo(accessToken, { kind: "bearer" })
    expect(userinfo1.sub).toBeTruthy()

    // Revoke the token
    const response = await revokeToken({ token: accessToken })
    expect(response.status).toBe(200)

    // Attempt to use revoked token
    const userinfoResp = await fetch(USERINFO, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    expect(userinfoResp.status).toBeGreaterThanOrEqual(400)
  })

  test("revoked refresh token cannot be used for token refresh", async ({ page }) => {
    const refreshToken = await getRefreshToken(page)

    // Revoke the refresh token
    const response = await revokeToken({ token: refreshToken })
    expect(response.status).toBe(200)

    // Attempt to exchange refresh token
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    const refreshResp = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(refreshResp.status).toBeGreaterThanOrEqual(400)
  })

  // ========== PKCE Tests ==========
  // Note: All tests now use PKCE by default. These tests remain to explicitly verify
  // PKCE flow works correctly with token revocation.
  test("revokes access token obtained via PKCE flow", async ({ page }) => {
    const accessToken = await getAccessToken(page)

    // Revoke the token
    const response = await revokeToken({ token: accessToken })
    expect(response.status).toBe(200)

    // Verify token is revoked (attempt to use it fails)
    const userinfoResp = await fetch(USERINFO, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    expect(userinfoResp.status).toBeGreaterThanOrEqual(400)
  })

  test("revokes refresh token obtained via PKCE flow", async ({ page }) => {
    const refreshToken = await getRefreshToken(page)

    // Revoke the refresh token
    const response = await revokeToken({ token: refreshToken })
    expect(response.status).toBe(200)

    // Verify refresh token is revoked (attempt to refresh fails)
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    const refreshResp = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(refreshResp.status).toBeGreaterThanOrEqual(400)
  })
})
