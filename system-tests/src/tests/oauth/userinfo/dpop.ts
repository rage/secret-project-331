import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import { USER_EMAIL, USER_PASSWORD, USERINFO } from "../../../utils/oauth/constants"
import { createDPoPKey } from "../../../utils/oauth/dpop"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { callUserInfo, exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /userinfo endpoint - DPoP Token Validation
// ============================================================================
test.describe("/userinfo endpoint - DPoP Token Validation", () => {
  async function getDPoPToken(page: Page): Promise<{
    accessToken: string
    key: Awaited<ReturnType<typeof createDPoPKey>>
  }> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state } = await oauthUrl(["openid", "profile"], {
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
      const consent = new ConsentPage(page, ["openid", "profile"])
      await consent.approve()
    } catch {
      // Already logged in or consent already granted
    }

    await page.waitForURL(/callback/, { timeout: 10000 })
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    const key = await createDPoPKey()
    const tok = await exchangeCodeForToken(code, { kind: "dpop", key }, codeVerifier)
    return { accessToken: tok.access_token, key }
  }

  test("valid DPoP token with DPoP header -> succeed", async ({ page }) => {
    const { accessToken, key } = await getDPoPToken(page)
    const userinfo = await callUserInfo(accessToken, { kind: "dpop", key })
    expect(userinfo.sub).toBeTruthy()
  })

  test("DPoP token used with Bearer scheme -> invalid_token error", async ({ page }) => {
    const { accessToken } = await getDPoPToken(page)

    // Try to use DPoP token with Bearer scheme
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_token")
  })

  test("DPoP token without DPoP header -> invalid_dpop_proof error", async ({ page }) => {
    const { accessToken } = await getDPoPToken(page)

    // Try to use DPoP token without DPoP header
    const response = await fetch(USERINFO, {
      method: "GET",
      headers: {
        Authorization: `DPoP ${accessToken}`,
        // Missing DPoP header
        Accept: "application/json",
      },
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_dpop_proof")
  })
})
