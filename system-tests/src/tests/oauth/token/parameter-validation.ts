import { expect, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import {
  REDIRECT_URI,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TOKEN,
  USER_EMAIL,
  USER_PASSWORD,
} from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /token endpoint - Parameter Validation
// ============================================================================
test.describe("/token endpoint - Parameter Validation", () => {
  test("missing client_id → invalid_client error", async () => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: "some-code",
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
    expect(data.error).toBe("invalid_client")
  })

  test("missing grant_type → invalid_request error", async () => {
    const body = new URLSearchParams({
      client_id: TEST_CLIENT_ID,
      code: "some-code",
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

  test("invalid grant_type → unsupported_grant_type error", async () => {
    const body = new URLSearchParams({
      client_id: TEST_CLIENT_ID,
      grant_type: "client_credentials",
      code: "some-code",
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
    expect(data.error).toBe("unsupported_grant_type")
  })

  test("unknown parameters → should be ignored", async ({ page }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state } = await oauthUrl(["openid"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)

    // Handle login and consent
    try {
      await page.waitForURL(/\/login\?return_to=.*/, { timeout: 2000 })
      await performLogin(page, USER_EMAIL, USER_PASSWORD)
    } catch {
      // Already logged in
    }

    try {
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
      const consent = new ConsentPage(page, ["openid"])
      await consent.approve()
    } catch {
      // Already granted
    }

    await page.waitForURL(/callback/, { timeout: 10000 })
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)

    // Exchange with unknown parameters
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      code_verifier: codeVerifier,
      unknown_param: "should-be-ignored",
      another_unknown: "value",
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    // Should still succeed
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.access_token).toBeTruthy()
  })
})
