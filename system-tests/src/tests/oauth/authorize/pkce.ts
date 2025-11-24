import { expect, test } from "@playwright/test"

import { AUTHORIZE, REDIRECT_URI, TEST_CLIENT_ID } from "../../../utils/oauth/constants"
import { navigateAndWaitForOAuthError } from "../../../utils/oauth/errorHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

// ============================================================================
// /authorize endpoint - PKCE Validation
// ============================================================================
test.describe("/authorize endpoint - PKCE Validation", () => {
  test("client requires PKCE, missing code_challenge → invalid_request error redirect", async ({
    page,
  }) => {
    // Test client requires PKCE (require_pkce: true in seed data)
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: "test-state",
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const error = await navigateAndWaitForOAuthError(page, url, "test-state")
    expect(error.error).toBe("invalid_request")
    expect(error.error_description?.toLowerCase()).toContain("pkce")
  })

  test("code_challenge without code_challenge_method → invalid_request error redirect", async ({
    page,
  }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: "test-state",
      code_challenge: codeChallenge,
      // Missing code_challenge_method
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const error = await navigateAndWaitForOAuthError(page, url, "test-state")
    expect(error.error).toBe("invalid_request")
  })

  test("code_challenge_method without code_challenge → invalid_request error redirect", async ({
    page,
  }) => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: "test-state",
      code_challenge_method: "S256",
      // Missing code_challenge
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const error = await navigateAndWaitForOAuthError(page, url, "test-state")
    expect(error.error).toBe("invalid_request")
  })

  test("invalid code_challenge_method (not 'S256' or 'plain') → invalid_request error redirect", async ({
    page,
  }) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TEST_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid",
      state: "test-state",
      code_challenge: codeChallenge,
      code_challenge_method: "invalid_method",
    })
    const url = `${AUTHORIZE}?${params.toString()}`
    const error = await navigateAndWaitForOAuthError(page, url, "test-state")
    expect(error.error).toBe("invalid_request")
  })

  test("valid S256 challenge → succeed", async ({ page }) => {
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
