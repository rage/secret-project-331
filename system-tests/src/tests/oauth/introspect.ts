import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../utils/oauth/consentPage"
import {
  INTROSPECT,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TOKEN,
  USER_EMAIL,
  USER_PASSWORD,
} from "../../utils/oauth/constants"
import { createDPoPKey } from "../../utils/oauth/dpop"
import { introspectToken } from "../../utils/oauth/introspectHelpers"
import { performLogin } from "../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../utils/oauth/pkce"
import { revokeToken } from "../../utils/oauth/revokeHelpers"
import { exchangeCodeForToken } from "../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../utils/oauth/urlHelpers"

// ============================================================================
// Token Introspection (RFC 7662)
// ============================================================================
test.describe("Token Introspection (RFC 7662)", () => {
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

  async function getDPoPToken(page: Page): Promise<string> {
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
    return tok.access_token
  }

  test("active access token -> returns token metadata", async ({ page }) => {
    const accessToken = await getBearerToken(page)
    const response = await introspectToken(accessToken)

    expect(response.active).toBe(true)
    expect(response.scope).toBeTruthy()
    expect(response.scope).toContain("openid")
    expect(response.scope).toContain("profile")
    expect(response.scope).toContain("email")
    expect(response.client_id).toBe(TEST_CLIENT_ID)
    expect(response.sub).toBeTruthy()
    expect(response.username).toBe(response.sub)
    expect(response.exp).toBeGreaterThan(0)
    expect(response.iat).toBeGreaterThan(0)
    expect(response.iss).toBeTruthy()
    expect(response.iss).toContain("/api/v0/main-frontend/oauth")
    expect(response.jti).toBeTruthy()
    expect(response.token_type).toBe("Bearer")
  })

  test("invalid/unknown token -> returns active: false", async () => {
    const response = await introspectToken("invalid-token-that-does-not-exist")

    expect(response.active).toBe(false)
    expect(response.scope).toBeUndefined()
    expect(response.client_id).toBeUndefined()
    expect(response.sub).toBeUndefined()
  })

  test("missing client_id -> invalid_client error", async () => {
    const body = new URLSearchParams({
      token: "some-token",
    })
    const response = await fetch(INTROSPECT, {
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

  test("invalid client_secret -> returns active: false", async ({ page }) => {
    const accessToken = await getBearerToken(page)
    const response = await introspectToken(accessToken, {
      clientSecret: "wrong-secret",
    })

    // RFC 7662: Return active: false for auth failures to prevent enumeration
    expect(response.active).toBe(false)
  })

  test("missing token parameter -> invalid_request error", async () => {
    const body = new URLSearchParams({
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(INTROSPECT, {
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

  test("empty token parameter -> invalid_request error", async () => {
    const body = new URLSearchParams({
      token: "",
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(INTROSPECT, {
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

  test("DPoP token introspection -> returns DPoP token_type", async ({ page }) => {
    const accessToken = await getDPoPToken(page)
    const response = await introspectToken(accessToken)

    expect(response.active).toBe(true)
    expect(response.token_type).toBe("DPoP")
  })

  test("Bearer token introspection -> returns Bearer token_type", async ({ page }) => {
    const accessToken = await getBearerToken(page)
    const response = await introspectToken(accessToken)

    expect(response.active).toBe(true)
    expect(response.token_type).toBe("Bearer")
  })

  test("token with user -> includes sub and username", async ({ page }) => {
    const accessToken = await getBearerToken(page)
    const response = await introspectToken(accessToken)

    expect(response.active).toBe(true)
    expect(response.sub).toBeTruthy()
    expect(response.username).toBeTruthy()
    expect(response.username).toBe(response.sub)
    // sub and username should be UUID strings
    expect(response.sub).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test("revoked token -> returns active: false", async ({ page }) => {
    const accessToken = await getBearerToken(page)

    // Verify token is active initially
    const response1 = await introspectToken(accessToken)
    expect(response1.active).toBe(true)

    // Revoke the token
    await revokeToken({ token: accessToken })

    // Introspect revoked token
    const response2 = await introspectToken(accessToken)
    expect(response2.active).toBe(false)
  })

  test("response includes Cache-Control: no-store header", async ({ page }) => {
    const accessToken = await getBearerToken(page)
    const response = await fetch(INTROSPECT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        token: accessToken,
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
      }).toString(),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  test("response always returns 200 OK even for invalid tokens", async () => {
    const response = await fetch(INTROSPECT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        token: "invalid-token",
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
      }).toString(),
    })

    // RFC 7662: Always return 200 OK
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.active).toBe(false)
  })

  test("token_type_hint parameter is accepted but ignored", async ({ page }) => {
    const accessToken = await getBearerToken(page)

    // Introspect with token_type_hint
    const body = new URLSearchParams({
      token: accessToken,
      token_type_hint: "access_token",
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(INTROSPECT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.active).toBe(true)
  })

  test("invalid token_type_hint -> invalid_request error", async () => {
    const body = new URLSearchParams({
      token: "some-token",
      token_type_hint: "invalid_hint",
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(INTROSPECT, {
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
})
