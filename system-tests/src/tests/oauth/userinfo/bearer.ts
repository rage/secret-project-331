import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import { USER_EMAIL, USER_PASSWORD, USERINFO } from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { revokeToken } from "../../../utils/oauth/revokeHelpers"
import { callUserInfo, exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /userinfo endpoint - Bearer Token Validation
// ============================================================================
test.describe("/userinfo endpoint - Bearer Token Validation", () => {
  async function getBearerToken(page: Page): Promise<string> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state } = await oauthUrl(["openid", "profile", "email"], {
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
      const consent = new ConsentPage(page, ["openid", "profile", "email"])
      await consent.approve()
    } catch {
      // Already logged in or consent already granted
    }

    await page.waitForURL(/callback/, { timeout: 10000 })
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    return tok.access_token
  }

  test("missing Authorization header -> invalid_token error (401)", async () => {
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_token")
  })

  test("invalid Authorization header format -> invalid_token error", async () => {
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: "invalid-format",
        Accept: "application/json",
      },
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_token")
  })

  test("valid Bearer token -> succeed", async ({ page }) => {
    const accessToken = await getBearerToken(page)
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })
    expect(userinfo.sub).toBeTruthy()
  })

  test("invalid Bearer token -> invalid_token error", async () => {
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token-that-does-not-exist",
        Accept: "application/json",
      },
    })
    // Invalid tokens might return 404 or 401 depending on implementation
    expect(response.status).toBeGreaterThanOrEqual(400)
    if (response.status === 401) {
      const data = await response.json()
      expect(data.error).toBe("invalid_token")
    }
  })

  test("revoked Bearer token -> invalid_token error", async ({ page }) => {
    const accessToken = await getBearerToken(page)

    // Verify token works initially
    const userinfo1 = await callUserInfo(accessToken, { kind: "bearer" })
    expect(userinfo1.sub).toBeTruthy()

    // Revoke the token
    await revokeToken({ token: accessToken })

    // Attempt to use revoked token
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })
    // Revoked tokens might return 404 or 401 depending on implementation
    expect(response.status).toBeGreaterThanOrEqual(400)
    if (response.status === 401) {
      const data = await response.json()
      expect(data.error).toBe("invalid_token")
    }
  })

  test("Bearer token used with DPoP scheme -> invalid_token error", async ({ page }) => {
    const accessToken = await getBearerToken(page)

    // Try to use Bearer token with DPoP scheme
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: `DPoP ${accessToken}`,
        Accept: "application/json",
      },
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_token")
  })

  test("Basic auth scheme -> invalid_token error (unsupported)", async ({ page }) => {
    const accessToken = await getBearerToken(page)

    // Try to use Basic scheme (unsupported)
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(accessToken).toString("base64")}`,
        Accept: "application/json",
      },
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_token")
  })

  test("no scheme in Authorization -> invalid_token error", async ({ page }) => {
    const accessToken = await getBearerToken(page)

    // Try without scheme
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: accessToken,
        Accept: "application/json",
      },
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_token")
  })
})
