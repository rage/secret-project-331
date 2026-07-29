import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import {
  getOAuthTestUser,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TOKEN,
} from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { setupRedirectServer, teardownRedirectServer } from "../../../utils/oauth/redirectServer"
import { revokeToken } from "../../../utils/oauth/revokeHelpers"
import { exchangeCodeForToken, redeemRefreshToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

test.beforeAll(async () => {
  await setupRedirectServer()
})

test.afterAll(async () => {
  await teardownRedirectServer()
})

const REFRESH_USER = getOAuthTestUser("refresh")

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
      await performLogin(page, REFRESH_USER.email, REFRESH_USER.password)
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
    expect(response.status).toBe(400)
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
    expect(response.status).toBe(400)
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
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_grant")
  })

  // Refresh tokens are single-use: rotation revokes the whole token family, so the
  // superseded token must be rejected afterwards (RFC 9700 reuse detection).
  test("refresh token rotation - old token revoked after use", async ({ page }) => {
    const refreshToken1 = await getRefreshToken(page)

    const rotation = await redeemRefreshToken(refreshToken1)
    expect(rotation.status).toBe(200)
    expect(rotation.data.access_token).toBeTruthy()
    expect(rotation.data.refresh_token).toBeTruthy()
    const refreshToken2 = rotation.data.refresh_token!

    const reuse = await redeemRefreshToken(refreshToken1)
    expect(reuse.status).toBe(400)
    expect(reuse.data.error).toBe("invalid_grant")

    // The rejected reuse must not take down the chain the rotation issued.
    const sibling = await redeemRefreshToken(refreshToken2)
    expect(sibling.status).toBe(200)
    expect(sibling.data.access_token).toBeTruthy()
  })

  test("revoked refresh token -> invalid_grant error", async ({ page }) => {
    const refreshToken = await getRefreshToken(page)

    await revokeToken({ token: refreshToken })

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
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_grant")
  })
})
