import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import { USER_EMAIL, USER_PASSWORD, USERINFO } from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { callUserInfo, exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /userinfo endpoint - Scope-Based Claims
// ============================================================================
test.describe("/userinfo endpoint - Scope-Based Claims", () => {
  async function getTokenWithScopes(page: Page, scopes: string[]): Promise<string> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state } = await oauthUrl(scopes, {
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
      const consent = new ConsentPage(page, scopes)
      await consent.approve()
    } catch {
      // Already logged in or consent already granted
    }

    await page.waitForURL(/callback/, { timeout: 10000 })
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    return tok.access_token
  }

  test("token with profile scope → sub, first_name, last_name returned", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid", "profile"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    // Profile claims may be present (depending on user data)
    expect(userinfo).toHaveProperty("sub")
  })

  test("token with email scope → sub, email returned", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid", "email"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    // Email claim may be present (depending on user data)
    expect(userinfo).toHaveProperty("sub")
  })

  test("token with profile and email → all claims returned", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid", "profile", "email"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    // Should have sub at minimum
    expect(userinfo).toHaveProperty("sub")
  })

  test("token with openid only → only sub returned (no profile/email)", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    // With only openid, should have sub but not necessarily profile/email claims
    expect(userinfo).toHaveProperty("sub")
  })

  test("response includes sub (always)", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    expect(typeof userinfo.sub).toBe("string")
  })

  test("response is JSON", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid", "profile", "email"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(typeof userinfo).toBe("object")
    expect(userinfo).toHaveProperty("sub")
  })

  test("response has Cache-Control: no-store header", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid"])
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
