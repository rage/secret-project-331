import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import {
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TOKEN,
  USER_EMAIL,
  USER_PASSWORD,
} from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { revokeToken } from "../../../utils/oauth/revokeHelpers"
import { exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /token endpoint - Refresh Token Grant
// ============================================================================
test.describe("/token endpoint - Refresh Token Grant", () => {
  async function getRefreshToken(page: Page): Promise<string> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state } = await oauthUrl(["openid", "offline_access"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)

    try {
      await page.waitForURL(/\/login\?return_to=.*/, { timeout: 2000 })
      await performLogin(page, USER_EMAIL, USER_PASSWORD)
    } catch {
      // Already logged in or consent already granted
    }

    try {
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
      const consent = new ConsentPage(page, ["openid", "offline_access"])
      await consent.approve()
    } catch {
      // Already logged in or consent already granted
    }

    await page.waitForURL(/callback/, { timeout: 10000 })
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    expect(tok.refresh_token).toBeTruthy()
    return tok.refresh_token!
  }

  test("missing refresh_token parameter -> invalid_request error", async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_request")
  })

  test("empty refresh_token parameter -> invalid_request error", async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: "",
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_request")
  })

  test("invalid/unknown refresh token -> invalid_grant error", async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: "invalid-refresh-token-that-does-not-exist",
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_grant")
  })

  test("refresh token rotation - old token revoked after use", async ({ page }) => {
    const refreshToken1 = await getRefreshToken(page)

    // Use refresh token to get new tokens
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken1,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.access_token).toBeTruthy()
    expect(data.refresh_token).toBeTruthy()
    const refreshToken2 = data.refresh_token

    // Old refresh token should not work anymore
    const body2 = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken1,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response2 = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body2.toString(),
    })
    expect(response2.status).toBeGreaterThanOrEqual(400)
    const data2 = await response2.json()
    expect(data2.error).toBe("invalid_grant")

    // New refresh token should work
    const body3 = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken2,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response3 = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body3.toString(),
    })
    expect(response3.status).toBe(200)
    const data3 = await response3.json()
    expect(data3.access_token).toBeTruthy()
  })

  test("revoked refresh token -> invalid_grant error", async ({ page }) => {
    const refreshToken = await getRefreshToken(page)

    // Revoke the refresh token
    await revokeToken({ token: refreshToken })

    // Try to use revoked refresh token
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_grant")
  })
})
