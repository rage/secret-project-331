import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import { USER_EMAIL, USER_PASSWORD, USERINFO } from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { callUserInfo, exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

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

  test("token with profile scope -> sub, first_name, last_name returned", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid", "profile"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    expect(typeof userinfo.sub).toBe("string")
    // Profile scope should include given_name and family_name fields
    // (fields may be null if user hasn't set names, but fields should exist)
    expect(userinfo).toHaveProperty("given_name")
    expect(userinfo).toHaveProperty("family_name")
    // Email should NOT be present without email scope
    expect(userinfo).not.toHaveProperty("email")
  })

  test("token with email scope -> sub, email returned", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid", "email"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    expect(typeof userinfo.sub).toBe("string")
    // Email scope should include email field
    expect(userinfo).toHaveProperty("email")
    expect(typeof userinfo.email).toBe("string")
    // Profile fields should NOT be present without profile scope
    expect(userinfo).not.toHaveProperty("given_name")
    expect(userinfo).not.toHaveProperty("family_name")
  })

  test("token with profile and email -> all claims returned", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid", "profile", "email"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    expect(typeof userinfo.sub).toBe("string")
    // With both scopes, all claim fields should be present
    expect(userinfo).toHaveProperty("given_name")
    expect(userinfo).toHaveProperty("family_name")
    expect(userinfo).toHaveProperty("email")
    expect(typeof userinfo.email).toBe("string")
  })

  test("token with openid only -> only sub returned (no profile/email)", async ({ page }) => {
    const accessToken = await getTokenWithScopes(page, ["openid"])
    const userinfo = await callUserInfo(accessToken, { kind: "bearer" })

    expect(userinfo.sub).toBeTruthy()
    expect(typeof userinfo.sub).toBe("string")
    // With only openid, should have sub but NOT profile/email claims
    expect(userinfo).not.toHaveProperty("given_name")
    expect(userinfo).not.toHaveProperty("family_name")
    expect(userinfo).not.toHaveProperty("email")
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
