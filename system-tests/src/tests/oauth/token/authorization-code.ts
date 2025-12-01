import { expect, Page, test } from "@playwright/test"

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

test.describe("/token endpoint - Authorization Code Grant", () => {
  async function getValidAuthCode(page: Page): Promise<{ code: string; codeVerifier: string }> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state } = await oauthUrl(["openid"], {
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
      const consent = new ConsentPage(page, ["openid"])
      await consent.approve()
    } catch {
      // Already logged in or consent already granted
    }

    await page.waitForURL(/callback/, { timeout: 10000 })
    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    return { code, codeVerifier }
  }

  test("missing code parameter -> invalid_request error", async () => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
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

  test("empty code parameter -> invalid_request error", async () => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: "",
      redirect_uri: REDIRECT_URI,
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

  test("invalid/unknown authorization code -> invalid_grant error", async () => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: "invalid-code-that-does-not-exist",
      redirect_uri: REDIRECT_URI,
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

  test("already used authorization code -> invalid_grant error", async ({ page }) => {
    const { code, codeVerifier } = await getValidAuthCode(page)

    // First exchange - should succeed
    const tok1 = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    expect(tok1.access_token).toBeTruthy()

    // Try to exchange same code again - should fail
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      code_verifier: codeVerifier,
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

  test("code with PKCE challenge, missing code_verifier -> invalid_grant error", async ({
    page,
  }) => {
    const { code } = await getValidAuthCode(page)

    // Try to exchange without code_verifier (but code has challenge)
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      // Missing code_verifier
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

  test("code with PKCE challenge, wrong code_verifier -> invalid_grant error", async ({ page }) => {
    const { code } = await getValidAuthCode(page)

    // Try to exchange with wrong code_verifier
    const wrongVerifier = generateCodeVerifier()
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      code_verifier: wrongVerifier,
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

  test("code with PKCE challenge, correct code_verifier -> succeed", async ({ page }) => {
    const { code, codeVerifier } = await getValidAuthCode(page)

    // Exchange with correct code_verifier
    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    expect(tok.access_token).toBeTruthy()
  })
})
