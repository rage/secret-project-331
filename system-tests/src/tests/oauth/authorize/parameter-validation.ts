import { expect, test } from "@playwright/test"

import { AUTHORIZE, REDIRECT_URI, TEST_CLIENT_ID } from "../../../utils/oauth/constants"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /authorize endpoint - Parameter Validation
// ============================================================================
test.describe("/authorize endpoint - Parameter Validation", () => {
  const validState = "test-state-123"

  test("missing client_id → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    // Validation errors return 400 responses directly, not redirects
    expect(response.status).toBe(400)
  })

  test("missing redirect_uri → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
  })

  test("missing scope → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
  })

  test("missing response_type → invalid_request error response", async () => {
    const params = new URLSearchParams({
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
  })

  test("empty client_id → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "",
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
  })

  test("empty redirect_uri → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: "",
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
  })

  test("empty scope → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
  })

  test("invalid response_type (not 'code') → unsupported_response_type error response", async () => {
    const params = new URLSearchParams({
      response_type: "token",
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
  })

  test("unknown parameters → should be ignored (RFC 6749 §3.1)", async ({ page }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url } = await oauthUrl(["openid"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    // Add unknown parameter
    const urlWithUnknown = `${url}&unknown_param=should_be_ignored&another_unknown=value`
    await page.goto(urlWithUnknown)
    // Should not error, should proceed to login/consent/callback
    // We'll just verify it doesn't error immediately
    await page.waitForTimeout(2000)
    // If we got redirected to callback or login, that's fine (unknown params ignored)
    const currentUrl = page.url()
    expect(
      currentUrl.includes("/callback") ||
        currentUrl.includes("/login") ||
        currentUrl.includes("/oauth_authorize_scopes"),
    ).toBe(true)
  })

  test("invalid client_id → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: "non-existent-client-id",
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    // Invalid client_id should NOT redirect (security: cannot verify redirect_uri without valid client)
    // Instead, return 400 Bad Request
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_request")
    expect(data.error_description).toContain("client_id")
  })

  test("unregistered redirect_uri → invalid_request error response", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: "http://evil.com/callback",
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    // Invalid redirect_uri should NOT redirect (security: never redirect to unregistered URIs)
    // Instead, return 400 Bad Request
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_request")
    expect(data.error_description).toContain("redirect_uri")
  })

  test("redirect_uri with fragment → should fail (per OAuth spec)", async () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: `${REDIRECT_URI}#fragment`,
      scope: "openid",
      state: validState,
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    // redirect_uri with fragment doesn't match registered URI, so return 400 (security)
    const response = await fetch(url, { redirect: "manual" })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("invalid_request")
    expect(data.error_description).toContain("redirect_uri")
  })

  test("redirect_uri exact match → succeed", async ({ page }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url } = await oauthUrl(["openid"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)
    // Should proceed to login or consent, not error
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    expect(currentUrl.includes("/login") || currentUrl.includes("/oauth_authorize_scopes")).toBe(
      true,
    )
  })
})
