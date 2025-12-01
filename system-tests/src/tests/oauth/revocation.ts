import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../utils/oauth/consentPage"
import {
  APP_DISPLAY_NAME,
  REVOKE,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TOKEN,
  USER_EMAIL,
  USER_PASSWORD,
  USERINFO,
} from "../../utils/oauth/constants"
import { performLogin } from "../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../utils/oauth/pkce"
import { revokeToken } from "../../utils/oauth/revokeHelpers"
import { callUserInfo, exchangeCodeForToken } from "../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../utils/oauth/urlHelpers"

test.describe("Token Revocation (RFC 7009)", () => {
  // Helper to get a valid access token using PKCE
  async function getAccessToken(page: Page): Promise<string> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state, scopes } = await oauthUrl(["openid", "email"], {
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
    const { url, state, scopes } = await oauthUrl(["openid", "offline_access"], {
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
    expect(tok.refresh_token).toBeTruthy()
    return tok.refresh_token!
  }

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
    expect(userinfoResp.status).toBe(404)
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
    expect(refreshResp.status).toBe(401)
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
    expect(userinfoResp.status).toBe(404)
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
    expect(refreshResp.status).toBe(401)
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
    expect(userinfoResp.status).toBe(404)
  })

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
    expect(response.status).toBe(400)
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
    // Should return error for missing required parameter (invalid_client)
    expect(response.status).toBe(401)
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
    expect(userinfoResp.status).toBe(404)
  })

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
    expect(userinfoResp.status).toBe(404)
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
    expect(refreshResp.status).toBe(401)
  })
})
